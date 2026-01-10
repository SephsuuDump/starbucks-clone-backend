import express, { response } from "express";
import { supabase } from "../config.js";
import { validateAndCalculateItems } from "./InventoryItem.js";

const router = express.Router()
const table = 'transfer_request'
const itemTable = 'transfer_item'
const responseFields = `
  id,
  from_warehouse(id, name),
  to_branch(id, name),
  to_warehouse(id, name),
  status,
  total_cost,
  expected_arrival,
  actual_arrival,
  notes,
  transfer_item (
    id,
    quantity,
    cost,
    inventory_item (
      skuid,
      name
    )
  )
`;

export async function getTransferById(transferId) {
  const {data} = await supabase
  .from(table)
  .select(responseFields)
  .eq('id', transferId)
  .maybeSingle()

  return data;
  
  
}

router.post("/create", async (req, res) => {
  try {
    const { from_warehouse, to_warehouse, to_branch, status, items, expected_arrival } = req.body;

    if (!from_warehouse || (!to_warehouse && !to_branch)) {
      return res.status(400).json({ message: "Invalid transfer request: must have to_warehouse or to_branch" });
    }

    const { validatedItems, totalCost } = await validateAndCalculateItems(items);

    const { data: transferRequest, error: transferError } = await supabase
      .from(table)
      .insert([
        {
          from_warehouse,
          to_warehouse: to_warehouse || null,
          to_branch: to_branch || null,
          status: status || "PENDING",
          total_cost: totalCost,
          expected_arrival : expected_arrival || null
        }
      ])
      .select(responseFields)
      .single();

    if (transferError) throw transferError;

    const transferItems = validatedItems.map((item) => ({
      transfer_request_id: transferRequest.id,
      inventory_item_id: item.inventory_item_id,
      quantity: item.quantity,
      cost: item.cost
    }));

    const { error: itemsError } = await supabase
    .from(itemTable)
    .insert(transferItems);

    if (itemsError) throw itemsError;

    const response = {
      from_warehouse: transferRequest.from_warehouse,
      to_branch: transferRequest.to_branch,
      to_warehouse: transferRequest.to_warehouse,
      status: transferRequest.status,
      total_cost: transferRequest.total_cost,
      items: validatedItems.map(({ inventory_item_id, quantity }) => ({
        inventory_item_id,
        qty: quantity
      }))
    };

    return res.status(201).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create transfer request", error: err.message });
  }
});

router.get("/get-all", async (req, res) => {
  const { status } = req.query;

  if(!status) {return res.status(404).json("Status is required")}

  try {
    const query = supabase
      .from(table)
      .select(responseFields);

    if (status) {
      query.eq("status", status.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to fetch transfer requests", error: err.message });
  }
});

router.get("/get-by-id", async (req, res) => {
  const { id } = req.query;

  if(!id) {return res.status(404).json("id is required")}

  try {
    const query = supabase
      .from(table)
      .select(responseFields)
      .eq('id', id)
    
      const {data, error} = await query
    
    if (error) {
        return res.status(500).json({message: error.message})
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch transfer request", error: err.message });
  }
});


router.get("/get-by-destination", async (req, res) => {
  const { destination, status, page = 1, limit = 5 } = req.query

  if (!destination || !status) {
    return res.status(400).json({
      message: "destination and status are required",
    })
  }

  const pageNum = Math.max(Number(page), 1)
  const limitNum = Math.max(Number(limit), 1)
  const from = (pageNum - 1) * limitNum
  const to = from + limitNum - 1

  try {
    let query = supabase
      .from(table)
      .select(responseFields, { count: "exact" })
      .or(`to_warehouse.eq.${destination},to_branch.eq.${destination}`)
      .eq("status", String(status).toUpperCase())

    if (String(status).toUpperCase() === "DELIVERED") {
      query = query.order("actual_arrival", { ascending: false, nullsFirst: false})
    } else {
      query = query.order("created_at", { ascending: false })
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})



router.get("/get-by-source", async (req, res) => {
  const { source, status, page = 1, limit = 5 } = req.query

  if (!source || !status) {
    return res.status(400).json({ message: "source and status are required" })
  }

  const pageNum = Math.max(Number(page), 1)
  const limitNum = Math.max(Number(limit), 1)
  const from = (pageNum - 1) * limitNum
  const to = from + limitNum - 1

  try {
    const { data, error, count } = await supabase
      .from(table)
      .select(responseFields, { count: "exact" })
      .eq("from_warehouse", source)
      .eq("status", String(status).toUpperCase())
      .order("created_at", {ascending:false})
      .range(from, to)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({
        data,
        meta: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.max(1, Math.ceil(count / limitNum)),
        },
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})


router.post("/update-status", async (req, res) => {
  const { id, status } = req.query;

  if (!id || !status) {
    return res.status(400).json({ message: "Transfer id and status are required" });
  }

  try {
    const transfer = await getTransferById(id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });

    const nextStatus = status.toUpperCase();

  if (nextStatus === "APPROVED") {
    for (const item of transfer.transfer_item) {
      const inventoryItemId =
        item.inventory_item?.skuid || item.inventory_item_id;
      const quantity = Number(item.quantity);

      const { data: sourceInventory, error } = await supabase
        .from("inventory")
        .select("id, qty")
        .eq("inventory_item_id", inventoryItemId)
        .eq("warehouse_id", transfer.from_warehouse.id)
        .maybeSingle();

      if (error) throw error;

      const availableQty = sourceInventory?.qty ?? 0;

      if (availableQty < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for inventory item: ${item.inventory_item?.name || "Unknown Item"}`
        });
      }
    }

    for (const item of transfer.transfer_item) {
      const inventoryItemId =
        item.inventory_item?.skuid || item.inventory_item_id;
      const quantity = Number(item.quantity);

      const { data: sourceInventory, error } = await supabase
        .from("inventory")
        .select("id, qty")
        .eq("inventory_item_id", inventoryItemId)
        .eq("warehouse_id", transfer.from_warehouse.id)
        .single();

      if (error) throw error;

      await supabase
        .from("inventory")
        .update({ qty: sourceInventory.qty - quantity })
        .eq("id", sourceInventory.id);

      await supabase.from("inventory_transaction").insert({
        changed_quantity: -quantity,
        source: "TRANSFER",
        type: "OUT",
        inventory_id: sourceInventory.id,
        transfer_request_id: transfer.id,
        created_at: new Date(),
      });
    }
  }

    if (nextStatus === "DELIVERED") {
      
      await supabase
        .from("transfer_request")
        .update({
          actual_arrival: new Date(),
        })
        .eq("id", transfer.id)
  
      for (const item of transfer.transfer_item) {
        const inventoryItemId =
          item.inventory_item?.skuid || item.inventory_item_id;
        const quantity = Number(item.quantity);
        const isWarehouseDest = !!transfer.to_warehouse?.id;

        let inventoryQuery = supabase
          .from("inventory")
          .select("id, qty")
          .eq("inventory_item_id", inventoryItemId);

        if (isWarehouseDest) {
          inventoryQuery = inventoryQuery
            .eq("warehouse_id", transfer.to_warehouse.id)
            .is("branch_id", null);
        } else {
          inventoryQuery = inventoryQuery
            .eq("branch_id", transfer.to_branch.id)
            .is("warehouse_id", null);
        }

        const { data: destInventory, error } =
          await inventoryQuery.maybeSingle();

        if (error) throw error;

        let finalInventory = destInventory;

        if (!destInventory) {
          const { data: newInventory, error: createError } = await supabase
            .from("inventory")
            .insert({
              inventory_item_id: inventoryItemId,
              qty: quantity,
              warehouse_id: isWarehouseDest ? transfer.to_warehouse.id : null,
              branch_id: isWarehouseDest ? null : transfer.to_branch.id,
            })
            .select("id, qty")
            .single();

          if (createError) throw createError;
          finalInventory = newInventory;
        } else {
          const { data: updatedInv, error: updateError } = await supabase
            .from("inventory")
            .update({ qty: destInventory.qty + quantity })
            .eq("id", destInventory.id)
            .select("id, qty")
            .single();

          if (updateError) throw updateError;
          finalInventory = updatedInv;
        }

        await supabase.from("inventory_transaction").insert({
          changed_quantity: quantity,
          source: "TRANSFER",
          type: "IN",
          inventory_id: finalInventory.id,
          transfer_request_id: transfer.id,
          created_at: new Date(),
        });
      }
    }

    const { error: updateError } = await supabase
      .from("transfer_request")
      .update({ status: nextStatus })
      .eq("id", id);

    if (updateError) throw updateError;

    return res.status(200).json({
      message: `Transfer status updated to ${nextStatus}`,
      id,
    });
  } catch (err) {
    console.error("Error updating transfer status:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

export default router