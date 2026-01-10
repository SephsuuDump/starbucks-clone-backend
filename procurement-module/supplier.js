import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = 'supplier';

router.get('/', async (req, res) => {
    const { data, error } = await supabase
    .from(table)
    .select('*');
    
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    console.log(id);
    const { data, error } = await supabase
    .from(table)
    .select(`
        *,
        supplier_item (
            id,
            name,
            unit_cost,
            description
        )
    `)
    .eq('id', id)
    .maybeSingle();

    if (!data) return res.status(400).json({ message: `Supplier with id: ${id} does not exists.` });
    if (error) return res.status(500).json({ message: error.message });

    return res.status(200).json(data);
})

router.put("/update", async (req, res) => {
    const { id } = req.query;
    const {
        name,
        contact,
        logo_url,
        description,
        rating,
        is_active
    } = req.body;

    try {
        // Check if supplier exists
        const { data: existing, error: findError } = await supabase
            .from(table)
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({ message: findError.message });
        }

        if (!existing) {
            return res.status(404).json({ message: `Supplier with id ${id} not found.` });
        }

        // Update supplier fields
        const { data, error } = await supabase
            .from(table)
            .update({
                name,
                contact,
                logo_url,
                description,
                rating,
                is_active
            })
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        return res.status(200).json({
            message: "Supplier updated successfully",
            data
        });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

router.put("/active", async (req, res) => {
    const { id } = req.query;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
        return res.status(400).json({ message: "`is_active` must be a boolean value." });
    }

    try {
        // Verify supplier exists
        const { data: existing, error: findError } = await supabase
            .from(table)
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({ message: findError.message });
        }

        if (!existing) {
            return res.status(404).json({ message: `Supplier with id ${id} not found.` });
        }

        // Update only the is_active field
        const { data, error } = await supabase
            .from(table)
            .update({ is_active })
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        return res.status(200).json({
            message: "Supplier status updated successfully",
            data
        });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});



export default router;