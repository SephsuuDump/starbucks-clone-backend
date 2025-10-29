import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const table = '_users';

router.get('/get-by-supplier', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(table)
    .select(`
        *,
        supplier(
            *,
            supplier_item(*)
        )
    `)
    .eq('id', id)
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(400).json({ message: `Supplier with id: ${id} does not exists.` });

    const formatttedData = {
        ...data,
        supplier: data.supplier[0],
        password: undefined,
        provider: undefined,
        external_id: undefined,
    }

    return res.status(200).json(formatttedData);
})

router.get('/get-by-employee', async (req, res) => {    
    const { id } = req.query;
    const { data, error } = await supabase
    .from(table)
    .select(`
        *,
        employee(
            branch(id, name)
        )
    `)
    .eq('id', id)
    .single();
    
    const formattedData = {
        ...data,
        branch: {
            id: data.employee.branch.id,
            name: data.employee.branch.name,
        },
        employee: undefined
    }

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(400).json({ message: `Supplier with id: ${id} does not exists.` });

    return res.status(200).json(formattedData);
})

router.post('/create', async (req, res) => {
    const newUser = req.body;
    const { data, error } = await supabase
    .from(table)
    .insert(newUser)
    
    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

export default router;