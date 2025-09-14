import express, { response } from "express";
import { supabase } from "../config.js";
import { getAllInventoryItems } from "./InventoryItem.js";
import { createInventoryRecord } from "./Inventory.js";

const router = express.Router();
const table = 'warehouse';
const responseFields = 'id, name, location, branch:branch_id (name, location), status'

router.post("/create", async (req, res) => {
    const warehouseInfo = req.body;

    const newWarehouse = {
        ...warehouseInfo,
        status: "ACTIVE"

    }

    const {data, error} = await supabase
    .from(table)
    .insert(newWarehouse)
    .select(responseFields)
    .single()

    if(error) {return res.status(500).json({message: error.message})}
    
    const { data: items, error: itemsErr } = await getAllInventoryItems();

    if (itemsErr) return res.status(500).json({ message: itemsErr.message });

    let inventoryBody = []

    for (const item of items) {
        const newInventory = {
            inventory_item_id: item.skuid,
            warehouse_id: data.id,
            qty: 0, 
        }

        inventoryBody.push(newInventory)
    }

    const { error: invErr } = await createInventoryRecord(inventoryBody);
    if (invErr) {
      console.error(`Failed to create Inventory`, invErr.message);
    }
   
    return res.status(201).json(data)
})

router.post("/update", async (req, res) => {
    const {id} = req.query;
    const updatedWarehouse = req.body

    const {data : existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

    if (!existing) {
        return res.status(404).json("Warehouse not found");
    }

    if(existingErr) {
        return res.status(500).json({message : existingErr.message})
    }

    const {data, error} = await supabase
    .from(table)
    .update(updatedWarehouse)
    .eq('id', id)
    .select(responseFields)
    .single()

    if(error)  {
        return res.status(500).json({message : error.message})
    }

    return res.status(200).json(data);

})

router.post("/update-status", async (req, res) => {
    const {id} = req.query
    const {status} = req.query
    const newStatus = status?.toUpperCase()

     const {data : existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle()

    if (!existing) {
        return res.status(404).json("Warehouse not found");
    }

    if(existingErr) {
        return res.status(500).json({message : existingErr.message})
    }

    const {data, error} = await supabase 
    .from(table)
    .update({status : newStatus})
    .eq('id', id)
    .select(responseFields)
    .single()

    if(error) {
        return res.status(500).json({message : error.message})
    }

    return res.status(200).json(data)



}) 

router.get("/get-by-id", async(req, res) => {
    const {id} = req.query

    const {data, error} = await supabase
    .from(table)
    .select(responseFields)
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

    if(data === null ) {
        return res.status(404).json("No warehouse found.")
    }

    if (error) {
        return res.status(500).json({message : error.message})
    }

    return res.status(200).json(data)
})

router.get("/get-all", async (req ,res) => {
    const {data, error} = await supabase
    .from(table)
    .select(responseFields)
    .eq('status', 'ACTIVE')

    if(error) {return res.status(500).json({message: error.message})}

    return res.status(200).json(data)
})

router.get("/get-by-location", async (req, res) => {
    const {location} = req.query

    if(location === null ) {return res.status(404).json("Branch location is required.")}

    const {data, error} = await supabase
    .from(table)
    .select(responseFields)
    .eq('status', 'ACTIVE')
    .ilike('location', `${location}%`)

    if (error) {return res.status(500).json({message: error.message})}

    if (data.length === 0 || data == null) {
        return res.status(404).json({message : "No branch with location  " + location + " found."})
    }

    return res.status(200).json(data)
})


export default router


