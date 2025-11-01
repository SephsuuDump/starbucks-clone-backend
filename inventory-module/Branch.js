import express from "express";
import multer from "multer";
import { supabase } from "../config.js";
import { getAllInventoryItems } from "./InventoryItem.js";
import { createInventoryRecord } from "./Inventory.js";

const router = express.Router();
const table = "branch";
const responseFields = "id, name, location, image_url";

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/create", upload.single("image"), async (req, res) => {
  const body = req.body;
  let imageUrl = null;

  try {
    if (req.file) {
      const fileExt = req.file.originalname.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `location-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;


      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }


    const { data, error } = await supabase
      .from(table)
      .insert([{ ...body, image_url: imageUrl }])
      .select(responseFields)
      .single();

    if (error) throw error;

    const { data: items, error: itemsErr } = await getAllInventoryItems();
    if (itemsErr) throw itemsErr;

    const inventoryBody = items.map((item) => ({
      inventory_item_id: item.skuid,
      warehouse_id: null,
      branch_id: data.id,
      qty: 0,
    }));

    const { error: invErr } = await createInventoryRecord(inventoryBody);
    if (invErr) console.error("Failed to create Inventory:", invErr.message);

    return res.status(201).json(data);
  } catch (error) {
    console.error("Error creating branch:", error.message);
    return res.status(500).json({ message: error.message });
  }
});


router.post("/update", upload.single("image"), async (req, res) => {
  const { id } = req.query;
  const updateRequest = req.body;

  if (!id) return res.status(400).json("Branch id is required");

  try {

    const { data: existing, error: existingErr } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (existingErr)
      return res.status(500).json({ message: existingErr.message });
    if (!existing)
      return res.status(404).json({ message: "Branch id not found." });


    let imageUrl = existing.image_url; 
    if (req.file) {
      const fileExt = req.file.originalname.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `location-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;


      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from(table)
      .update({ ...updateRequest, image_url: imageUrl })
      .eq("id", id)
      .select(responseFields)
      .single();

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error("Error updating branch:", err.message);
    return res.status(500).json({ message: err.message });
  }
});


router.get("/get-by-id", async (req, res) => {
    const {id}  = req.query

      if(id === null ) {return res.status(404).json("Branch id is required.")}

    const {data, error} = await supabase 
    .from(table)
    .select(responseFields)
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()

    if(!data) {
        return res.status(404).json("No inventory item with skuid " + skuid + " found.")
    }
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data)
})

router.get("/get-all", async (req ,res) => {
    const {data, error} = await supabase
    .from(table)
    .select(responseFields)
    .eq('is_deleted', false)
    .order('name', {ascending: true})

    if(error) {return res.status(500).json({message: error.message})}

    return res.status(200).json(data)
})

router.get("/get-by-location", async (req, res) => {
    const {location} = req.query

    if(location === null ) {return res.status(404).json("Branch location is required.")}

    const {data, error} = await supabase
    .from(table)
    .select(responseFields)
    .eq('is_deleted', false)
    .ilike('location', `${location}%`)

    if (error) {return res.status(500).json({message: error.message})}

    if (data.length === 0 || data == null) {
        return res.status(404).json({message : "No branch with location  " + location + " found."})
    }

    return res.status(200).json(data)


})

router.post("/delete", async (req, res) => {
    const {id} = req.query

    if(id === null ) {return res.status(400).json("Branch id is required")}

    const {data : existing, error : existingErr} = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()

    if(existingErr) {return res.status(500).json({message: existingErr.message})}
    
    if(!existing) {return res.status(404).json({message : "No branch with id" + id + " found."})}

    const {data , error} = await supabase
    .from(table)
    .update({'is_deleted': true})
    .eq('id', id)
    .select(responseFields)
    

    if(error) {return res.status(500).json({message : error.message})}

    return res.status(200).json({message : "Deleted branch  " + data[0].name})
    
})



export default router
