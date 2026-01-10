import express from "express";
import { supabase } from "../config.js";
import { formatCustomer, formatCustomers } from "./_helper.js";

const router = express.Router();
const parentTable = '_users';
const childTable = 'customers'

router.get('/get-all', async (req, res) => {
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *, 
        customers(*)
    `)
    .eq('role', 'CUSTOMER')
    .eq('is_deleted', false)
    .order('last_name', { ascending: true })

    if (error) return res.status(500).json({ message: error.message });
    console.log(data);
    

    return res.json(formatCustomers(data));
})

router.get('/get-by-id', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .select(`
        *,
        customers(*)
    `)
    .eq('id', id)
    .single();    

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` })

    return res.json(formatCustomer(data));
})

router.post('/create', async (req, res) => {
    const { user_id } = req.body;
    const { data, error } = await supabase
    .from(childTable)
    .insert({
        user_id
    })
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.post('/create-batch', async (req, res) => {
    const newCustomer = req.body;
    const { data, error } = await supabase
    .from(childTable)
    .insert(newCustomer)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.patch('/update', async (req, res) => {
    const { id, first_name, middle_name, last_name, ...otherFields } = req.body;
    const { email, ...customerFields } = otherFields;
    
    
    const { data, error } = await supabase
    .from(childTable)
    .update(customerFields)
    .eq('user_id', id)
    .select('*')
    .single();

    const { data: userData, error: userError } = await supabase
    .from(parentTable)
    .update({
        first_name: first_name,
        middle_name: middle_name,
        last_name: last_name,
    })
    .eq('id', id)

    if (error || userError) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${updatedCustomer.id} does not exists.` });

    return res.json(data);
})

router.patch('/delete', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .update({ is_deleted: true })
    .eq('id', id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` });

    return res.json(data);
})

export default router;