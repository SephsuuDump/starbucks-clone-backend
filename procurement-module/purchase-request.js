import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'purchase_request';

router.get('/', async (req, res) => {

    const { data, error } = await supabase
    .from(table)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
})

router.get('/', async (req, res) => {
    const { status } = req.query;
    const { data, error } = await supabase
    .from(table) 
    .select(`
            id,
            created_at,
            status,
            purchase_order (
                id,
                date,
                status,
                total_cost,
                supplier (
                    id,
                    name,
                    contact,
                    rating
                ),
                purchase_order_item (
                    id,
                    quantity,
                    unit_cost,
                    supplier_item (
                        id,
                        name,
                        description,
                        unit_cost
                    )
                )
            )
        `)
    .eq('status', status)

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
});

export default router;