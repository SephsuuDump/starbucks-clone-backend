import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = "projects";
const responseFields =
  "id, name, description, start_date, end_date, actual_end, status, budget, budget_approved, progress";

router.post("/create", async (req, res) => {
  const { name, description, start_date, end_date, budget } = req.body;

  try {
    const { data, error } = await supabase
      .from(table)
      .insert({
        name,
        description,
        start_date,
        end_date,
        budget,
        budget_approved: false,
        status: "PENDING_BUDGET",
        progress: 0,
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

router.post("/update", async (req, res) => {
  const { id } = req.query;
  const { name, description, end_date, budget } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: project, error: err1 } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (err1) return res.status(500).json({ message: err1.message });
    if (!project) return res.status(404).json({ message: "No project found" });

    if (project.status !== "PENDING_BUDGET" && budget !== undefined) {
      return res.status(400).json({
        message: "Budget can only be edited while project is in PENDING_BUDGET.",
      });
    }

    const { data, error: err2 } = await supabase
      .from(table)
      .update({
        name: name ?? project.name,
        description: description ?? project.description,
        end_date: end_date ?? project.end_date,
        budget: project.status === "PENDING_BUDGET"
          ? budget ?? project.budget
          : project.budget, 
      })
      .eq("id", id)
      .select(responseFields);

    if (err2) return res.status(500).json({ message: err2.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});



router.post("/approve-budget", async (req, res) => {
  const { id, approved } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: project, error: err1 } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .maybeSingle();

    if (err1) return res.status(500).json({ message: err1.message });
    if (!project) return res.status(404).json({ message: "Not found" });

    const newStatus = approved
      ? "PENDING_TASK_ACCEPTANCE"
      : "PENDING_BUDGET";

    const { data, error: err2 } = await supabase
      .from(table)
      .update({
        budget_approved: approved,
        status: newStatus,
      })
      .eq("id", id)
      .select(responseFields);

    if (err2) return res.status(500).json({ message: err2.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/delete-by-id", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(500).json({ message: "id is required" });

  try {
    const { data: project, error: err1 } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (err1) return res.status(500).json({ message: err1.message });
    if (!project) return res.status(404).json({ message: "No project found" });

    const { data, error: err2 } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    if (err2) return res.status(500).json({ message: err2.message });

    return res.status(200).json({ message: `Deleted project ${data[0].name}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/get-all", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(responseFields)
      .eq("is_deleted", false);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/get-by-id", async (req, res) => {
  const { id } = req.query;

  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq("id", id)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json(data);
});

export default router;
