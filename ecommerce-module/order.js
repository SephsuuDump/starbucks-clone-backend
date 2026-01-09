import express from "express";
import { supabase } from "../config.js";
import { now } from "mongoose";
import { formatSalesOrder, formatSalesOrders } from "./_helper.js";
import PDFDocument from 'pdfkit'

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
        branch(*),
        order_discounts(*, discounts(*))
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
    .order('created_at', { ascending: false });
    

    if (error) return res.status(500).json({ message: error.message });

    return res.json(formatSalesOrders(data));
})

router.get('/get-quotations', async (req, res) => {
    const { data, error } = await supabase
        .from(parentTable)
        .select(`
            *,
            order_items(
                *,
                branch_products(*, products(*))
            ),
            _users(*, customers(*)),
            branch(*),
            order_discounts(*, discounts(*))
        `)
        .gt('discount_amount', 0)   
        .order('created_at', { ascending: false })

    if (error) {
        return res.status(500).json({ message: error.message })
    }

    return res.json(formatSalesOrders(data))
})

router.post('/create', async (req, res) => {
    const { id, total_amount, branch_id, payment_mode, discount_amount } = req.body;

    const { data: orderData, error: orderError } = await supabase
    .from(parentTable)
    .insert({
        status: 'PENDING',
        customer_id: id,
        total_amount,
        branch_id,
        payment_mode,
        discount_amount: discount_amount ?? 0
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
                qty: inventory.qty - orderedQty
                })
                .eq('id', inventory.id);

            await supabase.from("inventory_transaction").insert({
                changed_quantity: orderedQty,
                source: "ORDER",
                type: "OUT",
                inventory_id: inventory.id,
                transfer_request_id: null,
            });

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

router.post('/generate-invoice', async (req, res) => {
    try {
        const orderData = req.body;

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
        'Content-Disposition',
        `attachment; filename=invoice-${orderData.id}.pdf`
        );

        doc.pipe(res);

        // Header with logo area
        doc.fontSize(20).text('STARBUCKS', 50, 50);
        doc.fontSize(10).text(orderData.branch.name, 50, 75);

        // Invoice title
        doc.fontSize(25).text('INVOICE', 400, 50, { align: 'right' });

        // Invoice details
        doc.fontSize(10);
        doc.text(`Invoice #: ${orderData.id.substring(0, 8).toUpperCase()}`, 400, 80, {
        align: 'right',
        });
        doc.text(
        `Date: ${new Date(orderData.created_at).toLocaleDateString()}`,
        400,
        95,
        { align: 'right' }
        );
        doc.text(`Status: ${orderData.status}`, 400, 110, { align: 'right' });

        // Customer information
        doc.fontSize(12).text('Bill To:', 50, 140);
        doc.fontSize(10);
        doc.text(
        `${orderData.customer.first_name} ${orderData.customer.last_name}`,
        50,
        160
        );
        doc.text(orderData.customer.address, 50, 175);
        doc.text(
        `${orderData.customer.city}, ${orderData.customer.province}`,
        50,
        190
        );
        doc.text(orderData.customer.country, 50, 205);
        doc.text(`Phone: ${orderData.customer.phone}`, 50, 220);

        // Line separator
        doc.moveTo(50, 250).lineTo(550, 250).stroke();

        // Table header
        const tableTop = 270;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('Category', 250, tableTop);
        doc.text('Qty', 380, tableTop);
        doc.text('Price', 430, tableTop);
        doc.text('Total', 500, tableTop);

        // Line under header
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table items
        doc.font('Helvetica');
        let yPosition = tableTop + 30;

        orderData.order_items.forEach((item) => {
        doc.text(item.name, 50, yPosition, { width: 180 });
        doc.text(item.category, 250, yPosition, { width: 110 });
        doc.text(item.quantity.toString(), 380, yPosition);
        doc.text(`₱${item.unit_price.toFixed(2)}`, 430, yPosition);
        doc.text(`₱${item.total_price.toFixed(2)}`, 500, yPosition);
        yPosition += 30;
        });

        // Line before totals
        yPosition += 10;
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

        // Calculate subtotal before discount
        const subtotal = orderData.order_items.reduce(
        (sum, item) => sum + item.total_price,
        0
        );

        // Totals section
        yPosition += 20;
        doc.font('Helvetica');
        doc.text('Subtotal:', 400, yPosition);
        doc.text(`₱${subtotal.toFixed(2)}`, 500, yPosition);

        // Discounts
        if (orderData.discounts && orderData.discounts.length > 0) {
        orderData.discounts.forEach((discount) => {
            yPosition += 20;
            doc.text(
            `${discount.name} (${discount.value}% off):`,
            400,
            yPosition
            );
            const discountAmount = subtotal * (discount.value / 100);
            doc.text(`-₱${discountAmount.toFixed(2)}`, 500, yPosition);
        });
        }

        // Total
        yPosition += 20;
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text('Total Amount:', 400, yPosition);
        doc.text(`₱${orderData.total_amount.toFixed(2)}`, 500, yPosition);

        // Payment information
        yPosition += 40;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Payment Method: ${orderData.payment_mode.toUpperCase()}`, 50, yPosition);

        // Footer
        doc.fontSize(8).text(
        'Thank you for your purchase!',
        50,
        doc.page.height - 100,
        { align: 'center', width: 500 }
        );
        doc.text(
        'For questions about this invoice, please contact your local Starbucks.',
        50,
        doc.page.height - 85,
        { align: 'center', width: 500 }
        );

        // Finalize PDF
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
});


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