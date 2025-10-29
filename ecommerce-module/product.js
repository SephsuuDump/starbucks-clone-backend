import express from "express";
import { supabase } from "../config.js";
import multer from "multer";

const router = express.Router();
const parentTable = 'products';
const upload = multer({ storage: multer.memoryStorage() });

router.get('/get-all', async (req, res) => {
    const { data, error } = await supabase
    .from(parentTable)
    .select(`*`)
    .eq('is_deleted', false)

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.get('/get-by-id', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .select(`*`)
    .eq('id', id)
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` })

    return res.json(data);
})

router.post('/create', async (req, res) => {
    const newProduct = req.body;

    const { data, error } = await supabase
    .from(parentTable)
    .insert(newProduct)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.post('/create-fd', upload.single("image"), async (req, res) => {
    const file = req.file;
    const { name, category, description, price } = req.body;
    
    if (!name || !category || !description || price === undefined) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const { data: imageUpload, error: uploadError } = await supabase.storage
        .from("images") 
        .upload(`product-images/${Date.now()}-${file.originalname}`, file.buffer, {
            contentType: file.mimetype,
        });

    if (uploadError) return res.status(500).json({ message: uploadError.message });

    const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(imageUpload.path);

    const { data, error } = await supabase
    .from(parentTable)
    .insert({
        name,
        category,
        description,
        price: Number(price),
        image_url: publicUrl,
    })
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.patch('/update', async (req, res) => {
    const updatedProduct = req.body;
    const { data, error } = await supabase
    .from(parentTable)
    .update(updatedProduct)
    .eq('id', updatedProduct.id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${updatedProduct.id} does not exists.` });

    return res.json(data);
})

router.patch('/delete', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .update({ is_deleted: true })
    .eq('id', id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` });

    return res.json(data);
})

export default router;