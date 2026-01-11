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

router.post('/rate-supplier', async (req, res) => {
    const rating = req.body;

    const { data: existing, error: errorExisting } = await supabase
    .from('supplier_rating')
    .select('*')
    .eq('supplier_id', rating.supplier_id)
    .eq('user_id', rating.user_id)
    .maybeSingle()

    if (errorExisting) return res.status(500).json({ message: errorExisting.message })

    if (!existing) {
        const { data: insertRating, error: errorInsertRating } = await supabase
        .from('supplier_rating')
        .insert(rating)
        .select('*')
        .single()

        if (errorInsertRating) return res.status(500).json({ message: errorInsertRating.message })

        return res.json(insertRating)
    }

    const { data: updateRating, error: errorUpdateRating } = await supabase
    .from('supplier_rating')
    .update({ rating: rating.rating })
    .eq('supplier_id', rating.supplier_id)
    .eq('user_id', rating.user_id)
    .select('*')
    .single()

    if (errorUpdateRating) return res.status(500).json({ message: errorUpdateRating.message })

    return res.json(updateRating)
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
    const { id, is_active } = req.body;

    try {
        const { data: existing, error: findError } = await supabase
            .from(table)
            .select("*")
            .eq("id", id)
            .single();

        // console.log(findError.message ?? "N/A");
        

        if (findError) {
            return res.status(500).json({ message: findError.message });
        }

        if (!existing) {
            return res.status(404).json({ message: `Supplier with id ${id} not found.` });
        }

        const { data, error } = await supabase
            .from(table)
            .update({ is_active: is_active })
            .eq("id", existing.id)
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