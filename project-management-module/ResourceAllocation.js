import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = "resource_allocation";
const responseFields =
  "id, task_id, resource_id, quantity, allocated_cost, created_at";


router.post("/create", async (req, res) => {
  const { task_id, resource_id, quantity, allocated_cost } = req.body;

  try {
    if (!task_id || !resource_id || !quantity) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const { data: resource, error: resourceErr } = await supabase
      .from("resources")
      .select("id, name, availability, unit")
      .eq("id", resource_id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (resourceErr)
      return res.status(500).json({ message: resourceErr.message });
    if (!resource)
      return res.status(404).json({ message: "Resource not found." });


    if (resource.availability < quantity) {
      return res.status(400).json({
        message: `Insufficient availability. Only ${resource.availability} ${resource.unit || "units"} left.`,
      });
    }

    const { data: allocation, error: insertErr } = await supabase
      .from(table)
      .insert({
        task_id,
        resource_id,
        quantity,
        allocated_cost,
        is_deleted: false,
      })
      .select(responseFields)
      .single();

    if (insertErr)
      return res.status(500).json({ message: insertErr.message });

    const newAvailability = resource.availability - quantity;

    const { error: updateErr } = await supabase
      .from("resources")
      .update({ availability: newAvailability })
      .eq("id", resource_id);

    if (updateErr)
      return res.status(500).json({
        message: `Allocation created but failed to update resource stock: ${updateErr.message}`,
      });


    return res.status(201).json({
      message: `Resource allocation created successfully. ${resource.name} availability updated to ${newAvailability}.`,
      data: allocation,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});



router.put("/update", async (req, res) => {
  const { id } = req.query;
  const { quantity, allocated_cost } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: existing, error: findErr } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (findErr) return res.status(500).json({ message: findErr.message });
    if (!existing) return res.status(404).json({ message: "Resource allocation not found" });

    const { data, error } = await supabase
      .from(table)
      .update({
        quantity,
        allocated_cost,
      })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({
      message: `Resource allocation ${id} updated successfully`,
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
    const { data: existing, error: findErr } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (findErr) return res.status(500).json({ message: findErr.message });
    if (!existing) return res.status(404).json({ message: "Resource allocation not found" });

    const { data, error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({
      message: `Resource allocation ${id} deleted successfully`,
      data: data[0],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/get-all", async (req, res) => {
  const {task_id, resource_id } = req.query;

  try {
    let query = supabase.from(table).select(responseFields).eq("is_deleted", false);

    if (task_id) query = query.eq("task_id", task_id);
    if (resource_id) query = query.eq("resource_id", resource_id);

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
  if (!data) return res.status(404).json({ message: "Resource allocation not found" });

  return res.status(200).json({ data });
});

export default router;
