import express from "express";
import { supabase } from "../config.js";
import { logProjectActivity } from "./utils/ProjectActivityLogger.js";

const router = express.Router();
const table = "tasks";

const responseFields =
  "id, project_id, name, description, start_date, expected_date, end_date, employee_id, status";

const responseFields2 =
  "id, project_id, name, description, start_date, expected_date, end_date, employee_id, status, employee:employee_id ( id, job_title, user:user_id ( first_name, last_name ) )";


export async function recalcProjectStatus(projectId) {
  if (!projectId) return;

  const { data: project } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();

  if (!project) return;

  if (project.status === "PENDING_BUDGET") return;

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, status, is_deleted")
    .eq("project_id", projectId)
    .eq("is_deleted", false);

  if (taskErr) {
    console.error("recalcProjectStatus taskErr:", taskErr.message);
    return;
  }

  const totalTasks = tasks?.length || 0;
  const doneTasks = tasks.filter(t => t.status === "DONE").length;

  const hasActive =
    tasks.some(t =>
      ["PENDING_ALLOCATIONS", "IN_PROGRESS", "DONE"].includes(t.status)
    ) || false;

  let progress = 0;
  if (totalTasks > 0) {
    progress = Number(((doneTasks / totalTasks) * 100).toFixed(2));
  }

  let allAllocApproved = true;

  if (totalTasks > 0) {
    const taskIds = tasks.map(t => t.id);

    const { data: allocations } = await supabase
      .from("resource_allocation")
      .select("is_approved")
      .in("task_id", taskIds)
      .eq("is_deleted", false);

    if (allocations?.length > 0) {
      allAllocApproved = allocations.every(a => a.is_approved === true);
    }
  }

  let status = "PENDING";

  if (totalTasks === 0) {
    status = "PENDING";
  } else if (doneTasks === totalTasks && allAllocApproved) {
    status = "DONE";
  } else if (hasActive && allAllocApproved) {
    status = "ONGOING";
  } else {
    status = "PENDING";
  }

  const updateData = { status, progress };

  if (status === "DONE") {
    updateData.actual_end = new Date().toISOString();
  } else {
    updateData.actual_end = null;
  }

  await supabase.from("projects").update(updateData).eq("id", projectId);

  await logProjectActivity({ // log project status recalculation
    project_id: projectId, // reference affected project
    actor_id: null, // system-triggered action
    actor_role: "SYSTEM", // system role
    entity_type: "PROJECT", // project-level action
    entity_id: projectId, // affected project
    action: "PROJECT_STATUS_UPDATED", // status change action
    description: `Project status recalculated to ${status}`, // readable log message
  });
}


router.post("/create", async (req, res) => {
  const {
    project_id,
    name,
    description,
    start_date,
    expected_date,
    end_date,
    employee_id,
    status,
  } = req.body;

  try {
    const normalizedStatus = (status || "PENDING").toUpperCase();

    const { data, error } = await supabase
      .from(table)
      .insert({
        project_id,
        name,
        description,
        start_date,
        expected_date,
        end_date,
        employee_id,
        status: normalizedStatus,
        is_deleted: false,
      })
      .select(responseFields)
      .single();

    if (error) return res.status(500).json({ message: error.message });

    await logProjectActivity({ // log task creation
      project_id, // reference related project
      actor_id: req.user?.id ?? null, // identify actor
      actor_role: req.user?.role ?? "PM", // PM role
      entity_type: "TASK", // task-level action
      entity_id: data.id, // affected task
      action: "TASK_CREATED", // action keyword
      description: `Task "${data.name}" was created`, // readable log message
    });

    await recalcProjectStatus(project_id);

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.put("/update", async (req, res) => {
  const { id } = req.query;
  const {
    name,
    description,
    start_date,
    expected_date,
    end_date,
    employee_id,
    status,
  } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: task } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!task) return res.status(404).json({ message: "No task found" });

    const newStatus = status?.toUpperCase() || task.status;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(table)
      .update({
        name: name ?? task.name,
        description: description ?? task.description,
        start_date: start_date ?? task.start_date,
        expected_date: expected_date ?? task.expected_date,
        end_date: newStatus === "DONE" ? now : end_date ?? task.end_date,
        employee_id: employee_id ?? task.employee_id,
        status: newStatus,
      })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    await logProjectActivity({ // log task update
      project_id: task.project_id, // reference related project
      actor_id: req.user?.id ?? null, // identify actor
      actor_role: req.user?.role ?? "PM", // PM role
      entity_type: "TASK", // task-level action
      entity_id: task.id, // affected task
      action: "TASK_UPDATED", // action keyword
      description: `Task "${task.name}" was updated`, // readable log message
    });

    await recalcProjectStatus(task.project_id);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.post("/respond", async (req, res) => {
  const { id } = req.query;
  const { action } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });
  if (!action) return res.status(400).json({ message: "action is required" });

  const upperAction = action.toUpperCase();

  if (!["ACCEPT", "REJECT"].includes(upperAction)) {
    return res.status(400).json({ message: "action must be ACCEPT or REJECT" });
  }

  try {
    const { data: task } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .maybeSingle();

    if (!task) return res.status(404).json({ message: "No task found" });

    const newStatus =
      upperAction === "ACCEPT" ? "PENDING_ALLOCATIONS" : "REJECTED";

    const { data, error } = await supabase
      .from(table)
      .update({ status: newStatus })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    await logProjectActivity({ // log task acceptance or rejection
      project_id: task.project_id, // reference related project
      actor_id: req.user?.id ?? null, // identify actor
      actor_role: "EMPLOYEE", // employee role
      entity_type: "TASK", // task-level action
      entity_id: task.id, // affected task
      action: upperAction === "ACCEPT" ? "TASK_ACCEPTED" : "TASK_REJECTED", // response action
      description:
        upperAction === "ACCEPT"
          ? `Task "${task.name}" was accepted`
          : `Task "${task.name}" was rejected`, // readable log message
    });

    await recalcProjectStatus(task.project_id);

    return res.status(200).json({
      message: `Task ${id} ${newStatus.toLowerCase()}`,
      data: data[0],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.post("/mark-done", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: task } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .maybeSingle();

    if (!task) return res.status(404).json({ message: "No task found" });

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from(table)
      .update({
        status: "DONE",
        end_date: today,
      })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    await logProjectActivity({ // log task completion
      project_id: task.project_id, // reference related project
      actor_id: req.user?.id ?? null, // identify actor
      actor_role: "EMPLOYEE", // employee role
      entity_type: "TASK", // task-level action
      entity_id: task.id, // affected task
      action: "TASK_COMPLETED", // completion action
      description: `Task "${task.name}" was marked as DONE`, // readable log message
    });

    await recalcProjectStatus(task.project_id);

    return res.status(200).json({
      message: `Task ${id} marked as DONE`,
      data: data[0],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.delete("/delete-by-id", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: task } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .maybeSingle();

    if (!task) return res.status(404).json({ message: "No task found" });

    const { data } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    await logProjectActivity({ // log task deletion
      project_id: task.project_id, // reference related project
      actor_id: req.user?.id ?? null, // identify actor
      actor_role: req.user?.role ?? "PM", // PM role
      entity_type: "TASK", // task-level action
      entity_id: task.id, // affected task
      action: "TASK_DELETED", // deletion action
      description: `Task "${task.name}" was deleted`, // readable log message
    });

    await recalcProjectStatus(task.project_id);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.get("/get-all", async (req, res) => {
  const { project_id } = req.query;

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select(responseFields2)
      .eq("project_id", project_id)
      .eq("is_deleted", false);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.get("/get-by-id", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq("id", id)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Task not found" });

  return res.status(200).json(data);
});


router.get("/get-by-employee", async (req, res) => {
  const { employee_id } = req.query;

  if (!employee_id)
    return res.status(400).json({ message: "employee_id is required" });

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select(responseFields2)
      .eq("employee_id", employee_id)
      .eq("is_deleted", false);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
