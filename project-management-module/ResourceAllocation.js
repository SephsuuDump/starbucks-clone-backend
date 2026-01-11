import express from "express";
import { supabase } from "../config.js";
import { recalcProjectStatus } from "./Tasks.js";
import { logProjectActivity } from "./utils/ProjectActivityLogger.js";


const router = express.Router();
const table = "resource_allocation";

const responseFields =
  "id, task_id, resource_id, quantity, allocated_cost, created_at, is_approved";

router.post("/create", async (req, res) => {
  const { task_id, resource_id, quantity, allocated_cost } = req.body;

  try {
    if (!task_id || !resource_id || !quantity || !allocated_cost) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id, name")
      .eq("id", task_id)
      .maybeSingle();

    if (!task) return res.status(404).json({ message: "Task not found." });

    const { data: project } = await supabase
      .from("projects")
      .select("budget")
      .eq("id", task.project_id)
      .maybeSingle();

    if (!project)
      return res.status(404).json({ message: "Project not found." });

    const { data: allocations } = await supabase
      .from("resource_allocation")
      .select("allocated_cost, tasks!inner(project_id)")
      .eq("tasks.project_id", task.project_id)
      .eq("is_deleted", false);

    const allocatedTotal = allocations.reduce(
      (sum, a) => sum + (a.allocated_cost || 0),
      0
    );

    if (allocatedTotal + allocated_cost > project.budget) {
      return res.status(400).json({
        message: "Allocation exceeds remaining project budget",
      });
    }

    const { data: resource } = await supabase
      .from("resources")
      .select("*")
      .eq("id", resource_id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!resource)
      return res.status(404).json({ message: "Resource not found." });

    if (resource.availability < quantity) {
      return res.status(400).json({
        message: `Only ${resource.availability} ${resource.unit} available.`,
      });
    }

    const { data: allocation, error } = await supabase
      .from(table)
      .insert({
        task_id,
        resource_id,
        quantity,
        allocated_cost,
        is_approved: false,
        is_deleted: false,
      })
      .select(responseFields)
      .single();

    if (error) return res.status(500).json({ message: error.message });

    await supabase
      .from("resources")
      .update({ availability: resource.availability - quantity })
      .eq("id", resource_id);

    await logProjectActivity({
      project_id: task.project_id,
      actor_id: req.user?.id ?? null,
      actor_role: req.user?.role ?? "PM",
      entity_type: "ALLOCATION",
      entity_id: allocation.id,
      action: "RESOURCE_ALLOCATED",
      description: `Allocated ${quantity} ${resource.unit} of ${resource.name} to task "${task.name}"`,
    });

    await recalcProjectStatus(task.project_id);

    return res.status(201).json({
      message: "Allocation created",
      data: allocation,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/approve", async (req, res) => {
  const { id } = req.query;
  const { is_approved } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });
  if (typeof is_approved === "undefined")
    return res.status(400).json({ message: "is_approved is required" });

  try {
    const { data: existing } = await supabase
      .from(table)
      .select("task_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!existing)
      return res.status(404).json({ message: "Allocation not found" });

    const { data, error } = await supabase
      .from(table)
      .update({ is_approved })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id, name")
      .eq("id", existing.task_id)
      .maybeSingle();

    if (task) {
      await logProjectActivity({ 
        project_id: task.project_id,
        actor_id: req.user?.id ?? null, 
        actor_role: "FINANCE", 
        entity_type: "ALLOCATION", 
        entity_id: id, 
        action: is_approved ? "ALLOCATION_APPROVED" : "ALLOCATION_REJECTED", 
        description: is_approved
          ? `Resource allocation approved for task "${task.name}"`
          : `Resource allocation rejected for task "${task.name}"`, 
      });
    }

    const { data: allAlloc } = await supabase
      .from("resource_allocation")
      .select("is_approved")
      .eq("task_id", existing.task_id)
      .eq("is_deleted", false);

    const allApproved =
      allAlloc.length > 0 && allAlloc.every(a => a.is_approved === true);

    if (allApproved) {
      await supabase
        .from("tasks")
        .update({ status: "IN_PROGRESS" })
        .eq("id", existing.task_id);
    }

    if (task) await recalcProjectStatus(task.project_id);

    return res.status(200).json({
      message: `Allocation ${id} set to approved=${is_approved}`,
      data: data[0]
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.delete("/delete-by-id", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: existing } = await supabase
      .from(table)
      .select("task_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing)
      return res.status(404).json({ message: "Allocation not found" });

    const { data } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id, name")
      .eq("id", existing.task_id)
      .maybeSingle();

    if (task) {
      await logProjectActivity({ 
        project_id: task.project_id,
        actor_id: req.user?.id ?? null, 
        actor_role: req.user?.role ?? "PM", 
        entity_type: "ALLOCATION",
        entity_id: id, 
        action: "ALLOCATION_REMOVED", 
        description: `Resource allocation removed from task "${task.name}"`,
      });
    }

    if (task) await recalcProjectStatus(task.project_id);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/get-all", async (req, res) => {
  const { id, is_approved } = req.query;

  if (!id)
    return res.status(400).json({ message: "project id required" });

  try {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("project_id", id)
      .eq("is_deleted", false);

    const taskIds = tasks.map(t => t.id);

    let query = supabase
      .from("resource_allocation")
      .select(
        `
        id,
        task_id,
        resource_id,
        quantity,
        allocated_cost,
        created_at,
        is_approved,
        resources(name, type, cost_per_unit, unit),
        tasks(name, status, start_date)
      `
      )
      .in("task_id", taskIds)
      .eq("is_deleted", false);

    if (is_approved !== undefined) {
      query = query.eq("is_approved", is_approved === "true");
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
