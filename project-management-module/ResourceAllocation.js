import express from "express";
import { supabase } from "../config.js";
import { recalcProjectStatus } from "./Tasks.js";

const router = express.Router();
const table = "resource_allocation";

const responseFields =
  "id, task_id, resource_id, quantity, allocated_cost, created_at, is_approved";

// ----------------------------------------------------
// CREATE ALLOCATION
// ----------------------------------------------------
router.post("/create", async (req, res) => {
  const { task_id, resource_id, quantity, allocated_cost } = req.body;

  try {
    if (!task_id || !resource_id || !quantity) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Check resource
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
        message: `Only ${resource.availability} ${resource.unit} available.`
      });
    }

    // Insert allocation
    const { data: allocation, error: insertErr } = await supabase
      .from(table)
      .insert({
        task_id,
        resource_id,
        quantity,
        allocated_cost,
        is_approved: false,
        is_deleted: false
      })
      .select(responseFields)
      .single();

    if (insertErr)
      return res.status(500).json({ message: insertErr.message });

    // Deduct resource availability
    const newAvailability = resource.availability - quantity;
    await supabase
      .from("resources")
      .update({ availability: newAvailability })
      .eq("id", resource_id);

    // Recalc project
    const { data: task } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("id", task_id)
      .maybeSingle();

    if (task) await recalcProjectStatus(task.project_id);

    return res.status(201).json({
      message: "Allocation created",
      data: allocation
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// APPROVE ALLOCATION
// ----------------------------------------------------
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

    // ------------------------------------------------
    // CHECK IF ALL ALLOCATIONS APPROVED → TASK IN_PROGRESS
    // ------------------------------------------------
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

    // Recalc project
    const { data: task } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("id", existing.task_id)
      .maybeSingle();

    if (task) await recalcProjectStatus(task.project_id);

    return res.status(200).json({
      message: `Allocation ${id} set to approved=${is_approved}`,
      data: data[0]
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// DELETE ALLOCATION
// ----------------------------------------------------
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
      .select("project_id")
      .eq("id", existing.task_id)
      .maybeSingle();

    if (task) await recalcProjectStatus(task.project_id);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// GET ALL FOR PROJECT
// ----------------------------------------------------
router.get("/get-all", async (req, res) => {
  const { id, is_approved } = req.query;

  if (!id)
    return res.status(400).json({ message: "project id required" });

  try {
    // Get task IDs
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
