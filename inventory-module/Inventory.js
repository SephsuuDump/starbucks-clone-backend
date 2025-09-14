import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = "inventory";
const responseFields = 'id, qty, inventory_item:inventory_item_id(name, category, unit_measurement, cost, description) , warehouse: warehouse_id (name, location), branch:branch_id (name, location)'


export async function createInventoryRecord(body) {
  return await supabase
    .from("inventory")
    .insert(body)
}

router.post("/create", async (req, res) => {
  const body = req.body;
  const { data, error } = await supabase
    .from(table)
    .insert(body)
    .select(responseFields)
    .single();

  if (error) return res.status(500).json({ message: error.message });

  return res.status(201).json(data);
});

router.post("/update", async (req, res) => {
  const { id } = req.query;
  const updateRequest = req.body;

  if (!id) return res.status(400).json("Inventory id is required");

  const { data: existing, error: existingErr } = await supabase
    .from(table)
    .select('*')
    .eq("id", id)
    .maybeSingle();

  if (existingErr) return res.status(500).json({ message: existingErr.message });

  if (!existing) return res.status(404).json({ message: "Inventory record not found" });

  const { data, error } = await supabase
    .from(table)
    .update({"qty" : existing.qty + updateRequest.qty})
    .eq("id", id)
    .select(responseFields)
    .single();

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json(data);
});

router.get("/get-by-id", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json("Inventory id is required");

  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq("id", id)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!data) return res.status(404).json("No inventory record found");

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json(data);
});

router.get("/get-all", async (req, res) => {
  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq('is_deleted', false);

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json(data);
});

router.get("/get-by-warehouse", async (req, res) => {
  const { warehouse_id } = req.query;

  if (!warehouse_id) return res.status(400).json("Warehouse id is required");

  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq("warehouse_id", warehouse_id);

  if (error) return res.status(500).json({ message: error.message });

  if (!data || data.length === 0)
    return res.status(404).json({ message: "No inventory found for this warehouse" });

  return res.status(200).json(data);
});


router.get("/get-by-branch", async (req, res) => {
  const { branch_id } = req.query;

  if (!branch_id) return res.status(400).json("branch id is required");

  const { data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq("branch_id", branch_id);

  if (error) return res.status(500).json({ message: error.message });

  if (!data || data.length === 0)
    return res.status(404).json({ message: "No inventory found for this warehouse" });

  return res.status(200).json(data);
});

router.post("/delete", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json("Inventory id is required");

  const { data: existing, error: existingErr } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (existingErr) return res.status(500).json({ message: existingErr.message });

  if (!existing) return res.status(404).json({ message: "No inventory record found" });

  const { data, error } = await supabase
    .from(table)
    .update({ is_deleted: true })
    .eq("id", id)
    .select("*");

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).send("Deleted inventory record with id " + id);
});

export default router;
