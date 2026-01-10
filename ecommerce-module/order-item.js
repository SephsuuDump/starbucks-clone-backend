import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const parentTable = 'order_items';

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

    if (error) {
        console.log('order item error', error.message);
        return res.status(500).json({ message: error.message });
    }
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` })

    return res.json(data);
})


router.post('/create', async (req, res) => {
    const newOrderItem = req.body;
    const { data, error } = await supabase
    .from(parentTable)
    .insert(newOrderItem)
    .select('*');

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.patch('/update', async (req, res) => {
    const updatedOrder = req.body;
    const { data, error } = await supabase
    .from(parentTable)
    .update({ 
        status: updatedOrder.status,
        updated_at: now()
    })
    .eq('id', updatedOrder.id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${updatedOrder.id} does not exists.` });

    return res.json(data);
})

export default router;