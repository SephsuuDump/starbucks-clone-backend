import express, { response } from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'inventory_item';



export async function getAllInventoryItems() {
  return await supabase
    .from("inventory_item")
    .select('*')
    .eq("is_deleted", false);
}

export async function validateAndCalculateItems(items) {
  let validatedItems = [];
  let totalCost = 0;

  for (const item of items) {
    const { data: invItem, error } = await supabase
      .from("inventory_item")
      .select("skuid, cost, name")
      .eq("skuid", item.inventory_item_id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invItem) {return res.status(404).json({message : "Inventory " + invItem.name + "is not found"})};

    const itemCost = (invItem.cost || 0) * item.qty;
    totalCost += itemCost;

    validatedItems.push({
      inventory_item_id: invItem.skuid,
      quantity: item.qty,
      cost: itemCost
    });
  }

  return { validatedItems, totalCost };
}



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
    .select('name, category, cost, unit_measurement, description')
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
    .select('name, category, cost, unit_measurement, description')
    .eq('category', category)
    .eq('is_deleted', false)

    if(error) {return res.status(500).json({message : existing.message})}

    return res.status(200).json(data)
})

router.get("/get-all", async (req, res) => {
  try {
    const page = parseInt(req.query.page ) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = (req.query.search ) || "";
    const sort = (req.query.sort ) || "az";
    const offset = (page - 1) * limit;


    let baseQuery = supabase.from(table).select("*", { count: "exact", head: true }).eq("is_deleted", false);
    let dataQuery = supabase.from(table).select("*").eq("is_deleted", false);

    if (search.trim() !== "") {
      baseQuery = baseQuery.ilike("name", `%${search}%`);
      dataQuery = dataQuery.ilike("name", `%${search}%`);
    }


    const { count, error: countError } = await baseQuery;
    if (countError) return res.status(500).json({ message: countError.message });


    switch (sort) {
      case "az":
        dataQuery = dataQuery.order("name", { ascending: true });
        break;
      case "za":
        dataQuery = dataQuery.order("name", { ascending: false });
        break;
      case "price-asc":
        dataQuery = dataQuery.order("cost", { ascending: true });
        break;
      case "price-desc":
        dataQuery = dataQuery.order("cost", { ascending: false });
        break;
      case "category":
        dataQuery = dataQuery.order("category", { ascending: true });
        break;
    }

    const { data, error } = await dataQuery.range(offset, offset + limit - 1);
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json({
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      data,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});




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

    return res.status(200).json({message : "Deleted Inventory item with SKUID " + skuid})
    
})

export default router;


