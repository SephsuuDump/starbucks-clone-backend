import express from "express";
import { supabase } from "../config.js";
import { logProjectActivity } from "./utils/ProjectActivityLogger.js";


const router = express.Router();
const table = "resources";
const responseFields =
  "id, type, name, cost_per_unit, unit, availability, project:project_id(id,name)";

router.post("/create", async (req, res) => {
  const { type, name, cost_per_unit, unit, availability, project_id } = req.body;

  try {
    const { data: project } = await supabase
      .from("projects")
      .select("budget")
      .eq("id", project_id)
      .maybeSingle();

    if (!project) return res.status(404).json({ message: "Project not found" });

    const { data: existingResources, error: resErr } = await supabase
      .from("resources")
      .select("cost_per_unit, availability")
      .eq("project_id", project_id)
      .eq("is_deleted", false);

    if (resErr) return res.status(500).json({ message: resErr.message });

    const currentTotalResourceCost = (existingResources || []).reduce((sum, r) => {
      return sum + (Number(r.cost_per_unit || 0) * Number(r.availability || 0));
    }, 0);

    const newResourceCost = Number(cost_per_unit || 0) * Number(availability || 0);

    if (currentTotalResourceCost + newResourceCost > Number(project.budget || 0)) {
      return res.status(400).json({
        message: "Total resource cost for this project exceeds the project budget",
      });
    }

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

    await logProjectActivity({
      project_id,
      actor_id: req.user?.id ?? null,
      actor_role: "FINANCE",
      entity_type: "RESOURCE",
      entity_id: data.id,
      action: "RESOURCE_CREATED",
      description: `Resource "${data.name}" was created`,
    });

    return res.status(201).json(data);
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

    const projectId = existing.project?.id;

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("budget")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr) return res.status(500).json({ message: projErr.message });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { data: allResources, error: allResErr } = await supabase
      .from("resources")
      .select("id, cost_per_unit, availability")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (allResErr) return res.status(500).json({ message: allResErr.message });

    const oldCost = Number(existing.cost_per_unit || 0) * Number(existing.availability || 0);
    const updatedCost = Number(cost_per_unit ?? existing.cost_per_unit ?? 0) *
      Number(availability ?? existing.availability ?? 0);

    const currentTotal = (allResources || []).reduce((sum, r) => {
      return sum + (Number(r.cost_per_unit || 0) * Number(r.availability || 0));
    }, 0);

    const projectedTotal = currentTotal - oldCost + updatedCost;

    if (projectedTotal > Number(project.budget || 0)) {
      return res.status(400).json({
        message: "Total resource cost for this project exceeds the project budget",
      });
    }

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

    await logProjectActivity({
      project_id: existing.project.id,
      actor_id: req.user?.id ?? null,
      actor_role: "FINANCE",
      entity_type: "RESOURCE",
      entity_id: existing.id,
      action: "RESOURCE_UPDATED",
      description: `Resource "${existing.name}" was updated`,
    });

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
    if (!existing)
      return res.status(404).json({ message: "Resource not found" });

    const { data, error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("id", id)
      .select(responseFields);

    if (error) return res.status(500).json({ message: error.message });

    await logProjectActivity({ 
      project_id: existing.project.id, 
      actor_id: req.user?.id ?? null,
      actor_role: "FINANCE", 
      entity_type: "RESOURCE", 
      entity_id: existing.id, 
      action: "RESOURCE_DELETED", 
      description: `Resource "${existing.name}" was deleted`,
    });

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
  const { id } = req.query;

  if (!id) return res.status(400).json({ message: "id is required" });

  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq("project_id", id)
    .eq("is_deleted", false);

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json(data);
});

export default router;
