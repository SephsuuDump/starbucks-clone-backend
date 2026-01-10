import express from "express";
import { supabase } from "../config.js";

const router = express.Router();

router.get('/get-previous-sales', async (req, res) => {
    const { data: salesOverview, error: salesOverviewError } = await supabase.rpc("get_sales_last_6_months");

    if (salesOverviewError) return res.status(500).json({ message: salesOverviewError.message });

    res.json(salesOverview);
})

router.get('/get-product-monthly-sales', async (req, res) => {
    const { data, error } = await supabase.rpc('get_product_monthly_sales');

    if (error) {
    console.error(error);
    return res.status(400).json(error);
    }

res.json(data);
})

router.get('/top-products', async (req, res) => {
    const { id } = req.query;

    const { data, error } = await supabase.rpc(
        'get_top_products',
        { branch: id || null }
    );

    if (error) return res.status(400).json({ error });

    res.json(data);
});

router.get('/get-customer-product-count', async (req, res) => {
    const { data, error } = await supabase.rpc(
        'get_customer_product_item_counts'
    );

    if (error) {
        console.error(error);
        return res.status(400).json(error);
    }

    res.json(data);
});

export default router;