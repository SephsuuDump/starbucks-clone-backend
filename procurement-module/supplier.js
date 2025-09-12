import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'supplier';

router.get('/', async (req, res) => {
    const { data, error } = await supabase
    .from(table)
    .select('*');
    
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    console.log(id);
    const { data, error } = await supabase
    .from(table)
    .select(`
        *,
        supplier_item (
            id,
            name,
            unit_cost,
            description
        )
    `)
    .eq('id', id)
    .maybeSingle();

    if (!data) return res.status(400).json({ message: `Supplier with id: ${id} does not exists.` });
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
})

export default router;