import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'purchase_order_item';

router.get('/', async (req, res) => {
    const { data, error } = await supabase
    .from(table)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
})

export default router;