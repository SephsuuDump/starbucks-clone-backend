import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = "resources";
const responseFields =
  "id, type, name, cost_per_unit, unit, availability, project:project_id(id,name)";

router.post("/create", async (req, res) => {
  const { type, name, cost_per_unit, unit, availability, project_id  } = req.body;

  try {
    const { data, error } = await supabase
      .from(table)
      .insert({
        type: type?.toUpperCase(),
        name,
        cost_per_unit,
        unit,
        availability,
        project_id,
        is_deleted: false,
      })
      .select(responseFields)
      .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.status(201).json(data);R
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.put("/update", async (req, res) => {
  const { id } = req.query;
  const { type, name, cost_per_unit, unit, availability } = req.body;

  if (!id) return res.status(400).json({ message: "id is required" });

  try {
    const { data: existing, error: findErr } = await supabase
      .from(table)
      .select(responseFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (findErr) return res.status(500).json({ message: findErr.message });
    if (!existing) return res.status(404).json({ message: "Resource not found" });

    const { data, error } = await supabase
      .from(table)
      .update({
        type: type?.toUpperCase(),
        name,
        cost_per_unit,
        unit,
        availability,
      })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({
      message: `Resource ${id} updated successfully`,
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
    if (!existing) return res.status(404).json({ message: "Resource not found" });

    const { data, error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({
      message: `Resource ${id} deleted successfully`,
      data: data[0],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/get-all", async (req, res) => {
  const { type, available_only } = req.query;

  try {
    let query = supabase.from(table).select(responseFields).eq("is_deleted", false);

    if (type) query = query.eq("type", type.toUpperCase());
    if (available_only === "true") query = query.gt("availability", 0);

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
  if (!data) return res.status(404).json({ message: "Resource not found" });

  return res.status(200).json({ data });
});


router.get("/get-by-project", async (req, res) => {
  const {id} = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  const {data, error } = await supabase
  .from(table)
  .select(responseFields)
  .eq("project_id", id)
  .eq("is_deleted", false)

  if(error) return res.status(500).json({message: error.message})

  return res.status(200).json(data)


})

export default router;
