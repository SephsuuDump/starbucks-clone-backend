import express from "express";
import { supabase } from "../config.js";
import { now } from "mongoose";
import { formatSalesOrders } from "./_helper.js";

const router = express.Router();
const parentTable = 'sales_orders';
const secondaryTable = 'customers';

router.get('/get-all', async (req, res) => {
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *, 
        order_items(
            *, branch_products(*)
        )
    `)
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

router.get('/get-by-customer', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *, 
        order_items(
            *, branch_products(*, products(*))
        ),
        branch(*)
    `)
    .eq('customer_id', id)
    .order('updated_at', { ascending: false });
    console.log('order', data);
    

    if (error) return res.status(500).json({ message: error.message });

    return res.json(formatSalesOrders(data));
})

router.get('/get-by-branch', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *, 
        order_items(
            *, branch_products(*, products(*))
        ),
        _users(*, customers(*))
    `)
    .eq('branch_id', id)
    .order('updated_at', { ascending: false });
    

    if (error) return res.status(500).json({ message: error.message });

    return res.json(formatSalesOrders(data));
})

router.post('/create', async (req, res) => {
    const { id, total_amount, branch_id, payment_mode } = req.body;

    const { data: orderData, error: orderError } = await supabase
    .from(parentTable)
    .insert({
        status: 'PENDING',
        customer_id: id,
        total_amount,
        branch_id,
        payment_mode
    })
    .select('*')
    .single();

    console.log('Order error', orderError);
    
    if (orderError) {
        return res.status(500).json({ message: orderError.message });
    }

    const { data: stats, error: statsError } = await supabase
    .from(secondaryTable)
    .select('total_spent, total_orders')
    .eq('user_id', id)
    .single();

    console.log('Stats error', statsError);

    if (statsError) {
        return res.status(500).json({ message: statsError.message });
    }

    const { data: updatedCustomer, error: updateError } = await supabase
    .from(secondaryTable)
    .update({
        total_spent: stats.total_spent + total_amount,
        total_orders: stats.total_orders + 1
    })
    .eq('user_id', id)
    .single();

    console.log('Update error', updateError);

    if (updateError) {
        return res.status(500).json({ message: updateError.message });
    }

    return res.json(orderData);
});

router.post('/complete-order', async (req, res) => {
    const { id, order_items } = req.body;

    for (const item of order_items) {
        const productId = item.id;
        const orderedQty = item.quantity;

        // Get latest stock from DB
        const { data: product, error: fetchError } = await supabase
            .from('branch_products')
            .select('stock')
            .eq('id', productId)
            .single();

        if (fetchError) {
            return res.status(500).json({ message: fetchError.message });
        }

        // Check if enough stock exists
        if (!product || product.stock < orderedQty) {
            return res.status(400).json({
                message: `Insufficient stock for product: ${item.name}`
            });
        }

        const newStock = product.stock - orderedQty;

        // Deduct stock
        const { error: updateError } = await supabase
            .from('branch_products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateError) {
            return res.status(500).json({ message: updateError.message });
        }
    }

    // 3. Update order status to COMPLETED
    const { error: statusError } = await supabase
        .from(parentTable)
        .update({ status: 'COMPLETED' })
        .eq('id', id);

    if (statusError) {
        return res.status(500).json({ message: statusError.message });
    }

    return res.json({
        message: "Order completed successfully.",
        status: "COMPLETED",
    });
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

// router.patch('/delete', async (req, res) => {
//     const { id } = req.query;
//     const { data, error } = await supabase
//     .from(parentTable)
//     .update({ is_deleted: true })
//     .eq('id', id)
//     .select('*')
//     .single();

//     if (error) return res.status(500).json({ message: error.message });
//     if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` });

//     return res.json(data);
// })

export default router;