import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = "inventory_transaction";

const responseFields = `
  id,
  created_at,
  source,
  type,
  changed_quantity,
  inventory:inventory_id (
    id,
    qty,
    warehouse:warehouse_id (id, name, location),
    branch:branch_id (id, name, location),
    inventory_item:inventory_item_id (name, unit_measurement)
  ),
  transfer_request:transfer_request_id (id, status)
`;

router.get("/get-all", async (req, res) => {
  try {
    const { branch_id, warehouse_id, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (!branch_id && !warehouse_id) {
      return res.status(400).json({
        message: "Either branch_id or warehouse_id is required.",
      });
    }

    let inventoryQuery = supabase.from("inventory").select("id");

    if (branch_id) inventoryQuery = inventoryQuery.eq("branch_id", branch_id);
    if (warehouse_id) inventoryQuery = inventoryQuery.eq("warehouse_id", warehouse_id);

    const { data: inventoryIds, error: invError } = await inventoryQuery;
    if (invError) throw invError;

    const ids = inventoryIds.map((i) => i.id);
    if (ids.length === 0)
      return res.status(200).json({
        page,
        limit,
        total: 0,
        totalPages: 0,
        data: [],
      });

    // STEP 2: Query transactions matching those inventory IDs
    let countQuery = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("inventory_id", ids);

    let dataQuery = supabase
      .from(table)
      .select(responseFields)
      .in("inventory_id", ids)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search && search.trim() !== "") {
      dataQuery = dataQuery.ilike("inventory.inventory_item.name", `%${search}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    const { data, error } = await dataQuery;
    if (error) throw error;

    return res.status(200).json({
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      data: data || [],
    });
  } catch (err) {
    console.error("Error fetching inventory logs:", err);
    return res.status(500).json({ message: err.message || "Unknown error" });
  }
});

export default router;
