import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const primaryTable = 'support_cases';

router.get('/get-all', async (req, res) => {
    const { data: support_cases, error: error_support_cases } = await  supabase
    .from('support_cases')
    .select(`
        *, customers(*, _users(*))
    `)

    const payload = support_cases.map(item => ({
        id: item.id,
        case_number: item.case_number,
        title: item.title,
        description: item.description,
        status: item.status,
        customer: item.customers._users.full_name,
        assigned_to: item.assigned_to
    }))

    if (error_support_cases) return res.status(500).json({ message: error_support_cases.message });

    return res.json(payload);
})

export default router;