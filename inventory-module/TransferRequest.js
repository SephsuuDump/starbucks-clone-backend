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
    const { from_warehouse, to_warehouse, to_branch, status, items } = req.body;

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
          status: "PENDING",
          total_cost: totalCost
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
  const { id } = req.query;
  const { status } = req.query;

  try {
    const { data , error } = await supabase
      .from("transfer_request")
      .update({'status' : status.toUpperCase()})
        .select(responseFields)
      .eq("id", id);

    if (error) {
        return res.status(500).json({message : error.message})
    };

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update status", error: err.message });
  }
});

export default router