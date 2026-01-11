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

router.post('/', async (req, res) => {
    const poi = req.body;
    const { data, error } = await supabase 
    .from(table)
    .insert(poi)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.status(201).json(data);
})

router.post('/receive-order', async (req, res) => {
    const { warehouse_id } = req.query;
    const po_items = req.body;

    for (var item of po_items) {
        const trimmedName = item.name.trim();

        const { data: existing, error: errorExisting } = await supabase
        .from('inventory_item')
        .select('*')
        .eq('name', item.name)
        .maybeSingle();

        console.log('1st', existing);
        

        if (existing) {

            const { data: exInvItem, error: errExInvItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('inventory_item_id', existing.id)
            .eq('warehouse_id', warehouse_id)
            .maybeSingle()

            if (errExInvItem) return res.status(500).json({ message: errExInvItem.message })

            if (exInvItem) {

                const { data: updateInv, error: errUpdateInv } = await supabase
                .from('inventory')
                .update({ qty: exInvItem.qty + item.quantity })
                .eq('id', exInvItem.id)

                if (errUpdateInv) return res.status(500).json({ message: errUpdateInv.message })

            } else {

                const { data: insertInv, error: errInsertInv } = await supabase
                .from('inventory')
                .insert({ 
                    inventory_item_id: existing.skuid,
                    warehouse_id,
                    branch_id: null,
                    qty: item.quantity
                })

                if (errInsertInv) return res.status(500).json({ message: errInsertInv.message })
            }

        } else {

            const toNumUnit = (s) => {
                if (!s) return null;

                const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
                return m ? [Number(m[1]), m[2].toLowerCase()] : null;
            };

            const measurement = toNumUnit(item.description);

            if (!measurement) {
                return res.status(400).json({
                    message: `Invalid measurement format: ${item.description}`
                });
            }

            const payload = {
                name: item.name.trim(),
                category: item.category.toLowerCase(),
                unit_measurement: measurement[1],
                required_stock: measurement[0],
                cost: item.unit_cost
            };

            console.log('inventory item payload', payload);

            // 1️⃣ Insert inventory_item
            const { data: insertInvItem, error: errInsertInvItem } = await supabase
                .from('inventory_item')
                .insert(payload)
                .select('*')
                .single();

            if (errInsertInvItem || !insertInvItem) {
                return res.status(500).json({
                    message: errInsertInvItem?.message ?? "Failed to create inventory item"
                });
            }

            // 2️⃣ Insert inventory
            const { error: errInsertInv } = await supabase
                .from('inventory')
                .insert({
                    inventory_item_id: insertInvItem.skuid,
                    warehouse_id,
                    branch_id: null,
                    qty: item.quantity
                });

            if (errInsertInv) {
                return res.status(500).json({ message: errInsertInv.message });
            }


        }
    }
})

export default router;