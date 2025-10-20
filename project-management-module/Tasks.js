import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = "tasks";
const responseFields =
  "id, project_id, name, description, start_date, expected_date, end_date, employee_id, status, progress";

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
    progress,
  } = req.body;

  try {
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
        status: status?.toUpperCase(),
        progress: progress ?? 0,
        is_deleted: false,
      })
      .select(responseFields)
      .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.put("/update", async (req, res) => {
  const { id } = req.query;
  const { name, description, start_date, expected_date, end_date, employee_id, status, progress } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: task, error: taskErr } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (taskErr) return res.status(500).json({ message: taskErr.message });
    if (!task) return res.status(404).json({ message: "No task found" });

    const { data, error } = await supabase
      .from(table)
      .update({
        name,
        description,
        start_date,
        expected_date,
        end_date,
        employee_id,
        status: status?.toUpperCase(),
        progress,
      })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.delete("/delete-by-id", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: task, error: taskErr } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (taskErr) return res.status(500).json({ message: taskErr.message });
    if (!task) return res.status(404).json({ message: "No task found" });

    const { data, error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/get-all", async (req, res) => {
  const { project_id, status, start, end } = req.query;

  try {
    let query = supabase.from(table).select(responseFields).eq("is_deleted", false);

    if (project_id) query = query.eq("project_id", project_id);
    // if (status) query = query.eq("status", status.toUpperCase());
    // if (start && end) query = query.gte("start_date", start).lte("end_date", end);

    const { data, error } = await query;

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({ data });
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
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Task not found" });

  return res.status(200).json({ data });
});

export default router;
