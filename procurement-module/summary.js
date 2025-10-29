import express from "express";
import { supabase } from "../config.js";

const router = express.Router();

router.get('/get-summary', async (req, res) => {
    const { data: suppliers, error: supplierError } = await supabase
    .from('supplier')
    .select('*');

    const { data: orders, error: ordersError } = await supabase
    .from('purchase_order')
    .select('*')

    if (supplierError) return res.status(500).json({ error: supplierError.message });
    if (ordersError) return res.status(500).json({ error: ordersError.message });
    console.log(process.env.NEST_PUBLIC_API_URL);
    

    const toReviewOrdersRes = await fetch(`${process.env.NEST_PUBLIC_API_URL}/purchase-orders/get-by-status?status=${encodeURIComponent('TO REVIEW')}`);
    const toReviewOrders = await toReviewOrdersRes.json();
    const pendingOrders = orders.filter(i => ['PENDING', 'SENT', 'CONFIRMED'].includes(i.status));
    const totalSpent = orders.reduce((acc, o) => acc + o.total_cost, 0);


    return res.status(200).json({
        suppliers: suppliers,
        pendingOrders: pendingOrders,
        toReviewOrders: toReviewOrders,
        totalSpent: totalSpent,
    })
})

export default router;
