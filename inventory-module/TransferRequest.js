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
  const { destination, status } = req.query;

  if (!destination || !status) {
    return res.status(400).json({ message: "destination and status are required" });
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select(responseFields)
      .or(`to_warehouse.eq.${destination},to_branch.eq.${destination}`)
      .eq('status', String(status).toUpperCase());

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.get("/get-by-source", async (req,res) => {
     const { source, status } = req.query;

     if(!source || !status) {
       return res.status(400).json({ message: "source and status are required" });
     }

    try {
        const {data, error}  = await supabase
        .from(table)
        .select(responseFields)
        .eq('from_warehouse', source)
        .eq('status', status)
        
        if(error) {return res.status(500).json({message : error.message})}

        return res.status(200).json(data)
    } catch (err) {
        return res.status(500).json({message : err.message})
    }
})


router.post("/update-status", async (req, res) => {
  const { id, status } = req.query;

  if (!id || !status) {
    return res.status(400).json({ message: "Transfer id and status are required" });
  }

  try {
    const { data: updatedTransfer, error: updateError } = await supabase
      .from("transfer_request")
      .update({ status: status.toUpperCase() })
      .eq("id", id)
      .select(`id, status, from_warehouse, to_branch, to_warehouse`)
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedTransfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    const transfer = await getTransferById(id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });


    for (const item of transfer.transfer_item) {
      const inventoryItemId = item.inventory_item?.skuid || item.inventory_item_id;
      const quantity = Number(item.quantity);

      if (status.toUpperCase() === "OUT") {
        const { data: sourceInventory, error: sourceError } = await supabase
          .from("inventory")
          .select("id, qty")
          .eq("inventory_item_id", inventoryItemId)
          .eq("warehouse_id", transfer.from_warehouse.id)
          .maybeSingle();

        if (sourceError) throw sourceError;
        if (!sourceInventory) {
          throw new Error(`Source inventory not found for item ${inventoryItemId}`);
        }

        const newQty = sourceInventory.qty - quantity;
        if (newQty < 0) {
          throw new Error(`Insufficient stock for item ${inventoryItemId}`);
        }

        await supabase
          .from("inventory")
          .update({ qty: newQty })
          .eq("id", sourceInventory.id);

        await supabase.from("inventory_transaction").insert({
          changed_quantity: -quantity,
          source: "TRANSFER",
          type: "OUT",
          inventory_id: sourceInventory.id,
          transfer_request_id: transfer.id,
          created_at: new Date()
        });
      }


      if (status.toUpperCase() === "DELIVERED") {
        const destinationFilter = transfer.to_warehouse
          ? { warehouse_id: transfer.to_warehouse.id }
          : { branch_id: transfer.to_branch.id };

        let { data: destInventory, error: destError } = await supabase
          .from("inventory")
          .select("id, qty")
          .eq("inventory_item_id", inventoryItemId)
          .match(destinationFilter)
          .maybeSingle();

        if (destError) throw destError;

        if (!destInventory) {
          const { data: newInventory, error: createError } = await supabase
            .from("inventory")
            .insert({
              inventory_item_id: inventoryItemId,
              qty: quantity,
              ...destinationFilter,
            })
            .select("id, qty")
            .single();

          if (createError) throw createError;
          destInventory = newInventory;
        } else {

          const newQty = destInventory.qty + quantity;
          const { data: updatedInv, error: updateError } = await supabase
            .from("inventory")
            .update({ qty: newQty })
            .eq("id", destInventory.id)
            .select("id, qty")
            .single();

          if (updateError) throw updateError;
          destInventory = updatedInv;
        }

        await supabase.from("inventory_transaction").insert({
          changed_quantity: quantity,
          source: "TRANSFER",
          type: "IN",
          inventory_id: destInventory.id,
          transfer_request_id: transfer.id,
          created_at: new Date()
        });
      }
    }

    return res.status(200).json({
      message: `Transfer status updated to ${status.toUpperCase()} and processed successfully.`,
      id,
    });
  } catch (err) {
    console.error("Error updating transfer status:", err.message);
    return res.status(500).json({ message: err.message });
  }
});


export default router