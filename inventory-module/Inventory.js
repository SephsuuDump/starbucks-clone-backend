import express from "express";
import { supabase } from "../config.js";
import { getTransferById } from "./TransferRequest.js";

const router = express.Router();
const table = "inventory";
const transactionTable = "inventory_transaction"
const responseFields = 'id, qty, inventory_item:inventory_item_id(skuid ,name, unit_measurement, required_stock) , warehouse: warehouse_id (name, location), branch:branch_id (name, location)'


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
  const { warehouse_id, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  if (!warehouse_id) return res.status(400).json("Warehouse_id is required");

  let countQuery = supabase
    .from(table)
    .select("inventory_item(name)", { count: "exact", head: true })
    .eq("is_deleted", false)
    .eq("warehouse_id", warehouse_id);

  if (search) {
    countQuery = countQuery
      .not("inventory_item", "is", null)
      .ilike("inventory_item.name", `%${search}%`);
  }

  const { count, error: countError } = await countQuery;
  if (countError) return res.status(500).json({ message: countError.message });

  let dataQuery = supabase
    .from(table)
    .select(responseFields)
    .eq("warehouse_id", warehouse_id)
    .eq("is_deleted", false)
    .order("inventory_item(name)", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    dataQuery = dataQuery
      .not("inventory_item", "is", null)
      .ilike("inventory_item.name", `%${search}%`);
  }

  const { data, error } = await dataQuery;
  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json({
    page,
    data: data || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  });
});


router.get("/get-by-branch", async (req, res) => {
  const { branch_id, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  if (!branch_id) return res.status(400).json("branch id is required");

  let countQuery = supabase
    .from(table)
    .select("inventory_item(name)", { count: "exact", head: true })
    .eq("is_deleted", false)
    .eq("branch_id", branch_id);

  if (search) {
    countQuery = countQuery
      .not("inventory_item", "is", null)
      .ilike("inventory_item.name", `%${search}%`);
  }

  const { count, error: countError } = await countQuery;
  if (countError) return res.status(500).json({ message: countError.message });

  let dataQuery = supabase
    .from(table)
    .select(responseFields)
    .eq("branch_id", branch_id)
    .eq("is_deleted", false)
    .order("inventory_item(name)", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    dataQuery = dataQuery
      .not("inventory_item", "is", null)
      .ilike("inventory_item.name", `%${search}%`);
  }

  const { data, error } = await dataQuery;
  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json({
    page,
    data: data || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  });
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

  return res.status(200).json(data);
});


router.post("/process-input", async (req, res) => {
  const { id, quantity } = req.query;

  if (!id || !quantity) {
    return res.status(400).json({ message: "Inventory Id and changed quantity is required" }); 
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from(table)
      .select("id, qty")  
      .eq("id", id)
      .single();

    if (fetchError) {
      return res.status(500).json({ message: fetchError.message });
    }

    const changedQuantity = Number(quantity); 
    const newQuantity = existing.qty + changedQuantity;

    const { data: updated, error: updateError } = await supabase
      .from(table)
      .update({ qty: newQuantity })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return res.status(500).json({ message: updateError.message });
    }

    const transactionBody = {
      changed_quantity: changedQuantity,
      source: "INPUT",
      type: "IN", 
      inventory_id: updated.id,
      transfer_request_id: null,
    };

    const { error: transactionError } = await supabase
      .from(transactionTable)
      .insert(transactionBody);

    if (transactionError) {
      return res.status(500).json({ message: transactionError.message });
    }

    return res.status(201).json(updated);

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/process-transfer", async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ message: "Transfer Request Id is required" });
  }

  try {
    const transfer = await getTransferById(id);

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    for (const item of transfer.transfer_item) {
      const { inventory_item_id, quantity } = item;

      console.log(inventory_item_id)
      console.log(transfer.from_warehouse)
      if (transfer.status === "APPROVED") {
        const { data: sourceInventory, error: sourceError } = await supabase
          .from("inventory")
          .select("id, qty")
          .eq("inventory_item_id", inventory_item_id)
          .eq("warehouse_id", transfer.from_warehouse)
          .maybeSingle();

        if (sourceError) {
          return res.status(500).json({ message: sourceError.message });
        }
        if (!sourceInventory) {
          return res.status(404).json({ message: "Source inventory not found" });
        }

        const newQty = sourceInventory.qty - Number(quantity);

        await supabase
          .from("inventory")
          .update({ qty: newQty })
          .eq("id", sourceInventory.id);

        await supabase.from("inventory_transaction").insert({
          changed_quantity: -Number(quantity),
          source: "TRANSFER",
          type: "OUT",
          inventory_id: sourceInventory.id,
          transfer_request_id: transfer.id,
          created_at: new Date()
        });
      }

      if (transfer.status === "DELIVERED") {
        const destinationFilter = transfer.to_warehouse
          ? { warehouse_id: transfer.to_warehouse }
          : { branch_id: transfer.to_branch };

        let { data: destInventory, error: destError } = await supabase
          .from("inventory")
          .select("id, qty")
          .eq("inventory_item_id", inventory_item_id)
          .match(destinationFilter)
          .maybeSingle();

        if (destError) {
          return res.status(500).json({ message: destError.message });
        }

        if (!destInventory) {
          const { data: newInv, error: createError } = await supabase
            .from("inventory")
            .insert({
              inventory_item_id,
              qty: Number(quantity),
              ...destinationFilter
            })
            .select("id, qty")
            .single();

          if (createError) {
            return res.status(500).json({ message: createError.message });
          }
          destInventory = newInv;
        } else {
          const newQty = destInventory.qty + Number(quantity);
          const { data: updatedInv, error: updateError } = await supabase
            .from("inventory")
            .update({ qty: newQty })
            .eq("id", destInventory.id)
            .select("id, qty")
            .single();

          if (updateError) {
            return res.status(500).json({ message: updateError.message });
          }
          destInventory = updatedInv;
        }

        await supabase.from("inventory_transaction").insert({
          changed_quantity: Number(quantity),
          source: "TRANSFER",
          type: "IN",
          inventory_id: destInventory.id,
          transfer_request_id: transfer.id,
          created_at: new Date()
        });
      }
    }

    return res.status(200).json({ message: "Transfer processed successfully", id });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


export default router;
