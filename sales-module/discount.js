import express, { Router } from "express";
import { supabase } from "../config.js";

const router = Router();
const primaryTable = 'discounts';
const secondaryTable = 'order_discounts';

router.get('/get-all', async (req, res) => {
    const { data, error } = await supabase
    .from(primaryTable)
    .select(
        `*`
    )
    .eq('is_deleted', false)

    if (error) return res.status(500).json({ message: error.message })

    return res.json(data)
})

router.post('/create', async (req, res) => {
    const { name, type, value } = req.body;
    const { data, error } = await supabase
    .from(primaryTable)
    .insert({ name, type, value })
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message })

    return res.json(data)
})

router.post('/create-order-discount', async (req, res) => {
    const orderDiscount = req.body;
    const { data, error } = await supabase
    .from(secondaryTable)
    .insert(orderDiscount)
    .select('*')

    if (error) {
        console.log('discount error', error.message);
        return res.status(500).json({ message: error.message })
    }

    return res.json(data)
})

router.post('/update', async (req, res) => {
    const { id, name, type, value } = req.body;
    const { data, error } = await supabase
    .from(primaryTable)
    .update({ name, type, value })
    .eq('id', id)
    .select('*')
    .single();

    if (!data) return res.status(500).json({ message: `No discount with id ${id}` })
    if (error) return res.status(500).json({ message: error.message })

    return res.json(data)
})

router.post('/delete', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(primaryTable)
    .update({ is_deleted: true })
    .eq('id', id)
    .select('*')
    .single();

    if (!data) return res.status(500).json({ message: `No discount with id ${id}` })
    if (error) return res.status(500).json({ message: error.message })

    return res.json(data)
})

export default router;