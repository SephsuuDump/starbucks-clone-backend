import express, { response } from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'warehouse';
const responseFields = 'id, name, location, branch:branch_id (name, location)'

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

    return res.status(400).json(data)
})

router.post("/update", async (req, res) => {
    const {id} = req.params;
    const updatedWarehouse = req.body

    const {data : existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .maybeSingle

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
    const {id} = req.params
    const {status} = req.params

     const {data : existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle

    if (!existing) {
        return res.status(404).json("Warehouse not found");
    }

    if(existingErr) {
        return res.status(500).json({message : existingErr.message})
    }

    const {data, error} = await supabase 
    .from(table)
    .update({status : status})
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
    .maybeSingle

    if(data === null ) {
        return res.status(404).json("No warehouse found.")
    }

    if (error) {
        return res.status(500).json({message : error.message})
    }

    return res.status(400).json(data)
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


