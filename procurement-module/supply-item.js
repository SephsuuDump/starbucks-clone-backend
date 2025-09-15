import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'supplier_item';

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('supplier_id', id)

    if (!data) return res.status(400).json({ message: `Supplier with id: ${id} does not exists.` });
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
});

router.post('/', async (req, res) => {
    const supply = req.body;
    const { data, error } = await supabase
    .from(table)
    .insert(supply)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.status(201).json(data);
})

export default router;