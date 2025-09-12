import express, { response } from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'inventory_item';



router.post("/create", async (req, res) => {
    const body = req.body;
    const {data, error} = await supabase
    .from(table)
    .insert(body)
    .select('*')
    .single();

    if (error) return res.status(500).json({message: error.message})

    return res.status(201).json(data)
})

router.post("/update", async (req, res) => {
    const { skuid } = req.query
    const updateRequest = req.body;

    if(skuid === null) {return res.status(400).json("SKUID is required")}

    const {data : existing, error : existingErr } = await supabase
    .from(table)
    .select('*')
    .eq('skuid', skuid)
    .eq('is_deleted', false)
    .maybeSingle()

    if(existingErr) { return res.status(404).json({message: existingErr.message})}

    if(!existing) { return res.status(404).json({message: "Skuid not found."})}
 
    const { data, error } = await supabase
        .from(table)
        .update(updateRequest)
        .eq('skuid', skuid)
        .select('*')
        .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
})

router.get("/find-by-skuid", async (req, res) => {
    const {skuid}  = req.query

     if(skuid === null) {return res.status(400).json("SKUID is required")}

    const {data, error} = await supabase 
    .from(table)
    .select('name, category, cost, unit_measurement')
    .eq('skuid', skuid)
    .eq('is_deleted', false)
    .maybeSingle()

    if(!data) {
        return res.status(404).json("No inventory item with skuid " + skuid + " found.")
    }
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data)
})

router.get("/find-by-category", async (req, res) => {
    const {category} = req.query;

    if(category === null) {return res.status(400).json("Inventory Item category is required")}

    const {data: existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('category', category)
    .limit(1)

    if(existingErr) {return res.status(500).json({message : existingErr.message})}

    if(!existing || existing.length === 0 ) {return res.status(404).json("No Category found for Inventory Item")}

    const {data, error} = await supabase
    .from(table)
    .select('name, category, cost, unit_measurement')
    .eq('category', category)
    .eq('is_deleted', false)

    if(error) {return res.status(500).json({message : existing.message})}

    return res.status(200).json(data)
})

router.get("/get-all", async (req, res) => {
    const {data, error} = await supabase
    .from(table)
    .select('*')
    .eq('is_deleted', false)

    if(error) {return res.status(500).json({message: error.message})}

    return res.status(200).json(data)
})

router.post("/delete", async (req, res) => {
    const {skuid} = req.query

    const {data : existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('skuid', skuid)
    .eq('is_deleted', false)
    .maybeSingle()

    if(existingErr) {return res.status(500).json({message: existingErr.message})}
    
    if(!existing) {return res.status(404).json({message : "No inventory item with skuid " + skuid + " found."})}

    const {data , error} = await supabase
    .from(table)
    .update({'is_deleted': true})
    .eq('skuid', skuid)
    

    if(error) {return res.status(500).json({message : error.message})}

    return res.status(200).send("Deleted Inventory item with SKUID " + skuid)
    
})

export default router;


