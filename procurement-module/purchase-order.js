import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'purchase_order';

router.get('/', async (req, res) => {
    const { status } = req.query;

    let query = supabase
        .from(table)
        .select(`
            *,
            supplier(name, contact),
            purchase_order_item(*, supplier_item(*))
        `);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ message: error.message });

    const formattedData = data.map((item) => ({
        id: item.id,
        date: item.date,
        status: item.status,
        total_cost: item.total_cost,
        supplier: item.supplier,
        supplies: item.purchase_order_item.map((subitem) => ({
            name: subitem.supplier_item.name,
            quantity: subitem.quantity,
            description: subitem.supplier_item.description,
            unit_cost: subitem.supplier_item.unit_cost
        }))
    }))

    return res.status(200).json(formattedData);
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
    .from(table)
    .select(`
        *,
        supplier(
            *
        ),
        purchase_order_item(
            *,
            supplier_item(*)
        ),
        purchase_order_timeline(
            status, date
        )
    `)
    .eq('id', id)
    .single();

    if (error) return res.status(500).json({ message: error.message });

    const formattedData = {
        id: data.id,
        date: data.date,
        status: data.status,
        total_cost: data.total_cost,
        supplier: data.supplier,
        supplies: data.purchase_order_item.map((subitem) => ({
            name: subitem.supplier_item.name,
            quantity: subitem.quantity,
            description: subitem.supplier_item.description,
            unit_cost: subitem.supplier_item.unit_cost
        })),
        sent_date: data.purchase_order_timeline.find(t => t.status === "SENT")?.date || null,
        confirmed_date: data.purchase_order_timeline.find(t => t.status === "CONFIRMED")?.date || null,
        delivered_date: data.purchase_order_timeline.find(t => t.status === "DELIVERED")?.date || null
    }

    return res.status(200).json(formattedData);
});

router.post('/', async (req, res) => {
    const po = req.body;
    const { data, error } = await supabase
    .from(table)
    .insert(po)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });

    const { data: insert, error: insertError } = await supabase
    .from('purchase_order_timeline')
    .insert({ po_id: data.id, status: data.status });
    
    if (insertError) return res.status(500).json({ message: insertError.message });

    return res.status(201).json(data);
});

router.post('/get-by-supplier-status', async (req, res) => {
    const { id, status } = req.body;

    const { data, error } = await supabase
    .from(table)
    .select(`
        *,
        supplier(name, contact),
        purchase_order_item(*, supplier_item(*))
    `)
    .eq('supplier_id', id) 
    .eq('status', status);

    if (error) return res.status(500).json({ message: error.message });

    const formattedData = data.map((item) => ({
        id: item.id,
        date: item.date,
        status: item.status,
        total_cost: item.total_cost,
        supplier: item.supplier,
        supplies: item.purchase_order_item.map((subitem) => ({
            name: subitem.supplier_item.name,
            quantity: subitem.quantity,
            description: subitem.supplier_item.description,
            unit_cost: subitem.supplier_item.unit_cost
        }))
    }))

    return res.status(200).json(formattedData);
});

router.patch('/update-status', async (req, res) => {
    const { id, status } = req.body;
    const { data, error } = await supabase
    .from(table)
    .update({ status: status })
    .eq('id', id)
    .select('*')
    .maybeSingle();

    if (error) return res.status(500).json({ message: error.message });

    const { data: insert, error: insertError } = await supabase
    .from('purchase_order_timeline')
    .insert({ po_id: data.id, status: data.status });
    
    if (insertError) return res.status(500).json({ message: insertError.message });

    return res.json(data);
})

export default router;