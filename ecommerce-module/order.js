import express from "express";
import { supabase } from "../config.js";
import { now } from "mongoose";
import { formatSalesOrder, formatSalesOrders } from "./_helper.js";

const router = express.Router();
const parentTable = 'sales_orders';
const secondaryTable = 'customers';

router.get('/get-all', async (req, res) => {
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *, 
        order_items(
            *, branch_products(*, products(*))
        ),
        _users(*, customers(*)),
        branch(*)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ message: error.message });

    return res.json(formatSalesOrders(data));
})

router.get('/get-by-id', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *, 
        order_items(
            *, branch_products(*, products(*))
        ),
        _users(*, customers(*)),
        branch(*)
    `)
    .eq('id', id)
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` })

    return res.json(formatSalesOrder(data));
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
        _users(*, customers(*)),
        branch(*)
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
    const { branchId, id, order_items } = req.body;

    for (const item of order_items) {
        const productId = item.id;
        const orderedQty = item.quantity;

        const { data: product, error: fetchError } = await supabase
            .from('branch_products')
            .select('stock')
            .eq('id', productId)
            .single();

        if (fetchError) {
            return res.status(500).json({ message: fetchError.message });
        }

        if (!product || product.stock < orderedQty) {
            return res.status(400).json({
                message: `Insufficient stock for product: ${item.name}`
            });
        }

        const newStock = product.stock - orderedQty;

        const { data: logData, error: logError } = await supabase
            .from('branch_product_logs')
            .insert({
                quantity: orderedQty,
                flow: "OUT",
                branch_product_id: productId,
            })

        if (logError) {
            return res.status(500).json({ message: fetchError.message });
        }

        const { error: updateError } = await supabase
            .from('branch_products')
            .update({ stock: newStock })
            .eq('id', productId);

        const { data: inv, error: invError } = await supabase
        .from('product_inventory_item')
        .select('*')
        .eq('product_id', item.product_id);
        console.log('prod id', item.product_id);
        
        console.log(inv);
        

        if (invError) throw invError.message;
        if (!inv || inv.length === 0) return;
    
        for (const subItem of inv) {
            const { data: inventory, error: inventoryError } = await supabase
                .from('inventory')
                .select('*')
                .eq('branch_id', branchId)
                .eq('inventory_item_id', subItem.inventory_item_id)
                .single();
            console.log('inve', inventory);
            

            if (inventoryError) continue;
            const { error: updateError } = await supabase
                .from('inventory')
                .update({
                qty: inventory.qty - 1
                })
                .eq('id', inventory.id);

            if (updateError) throw updateError.message;
        }


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