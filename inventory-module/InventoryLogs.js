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

    let countQuery = supabase
      .from(table)
      .select("inventory:inventory_id(id)", { count: "exact", head: true });

    if (branch_id) countQuery = countQuery.eq("inventory.branch_id", branch_id);
    if (warehouse_id) countQuery = countQuery.eq("inventory.warehouse_id", warehouse_id);

    if (search && search.trim() !== "") {
      countQuery = countQuery.ilike("inventory.inventory_item.name", `%${search}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;


    let dataQuery = supabase
      .from(table)
      .select(responseFields)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (branch_id) dataQuery = dataQuery.eq("inventory.branch_id", branch_id);
    if (warehouse_id) dataQuery = dataQuery.eq("inventory.warehouse_id", warehouse_id);

    if (search && search.trim() !== "") {
      dataQuery = dataQuery.ilike("inventory.inventory_item.name", `%${search}%`);
    }

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
    console.error("Error fetching inventory logs:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

export default router;
