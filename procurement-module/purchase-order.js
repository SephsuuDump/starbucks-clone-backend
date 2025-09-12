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
            description: subitem.description,
            unit_cost: subitem.unit_cost
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
        )
    `)
    .eq('id', id)

    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
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

    return res.json(data);
})

export default router;