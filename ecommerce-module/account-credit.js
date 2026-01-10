import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const primaryTable = 'account_credit';

router.get('/get-by-user', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(primaryTable)
    .select(`
        *
    `)
    .eq('user_id', id)
    .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.post('/charge-credit', async (req, res) => {
    const { user_id, payment_method, total_amount } = req.body;

    if (!user_id || !payment_method || !total_amount) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    const { data: wallet, error: fetchError } = await supabase
        .from(primaryTable)
        .select('*')
        .eq('user_id', user_id)
        .single();

    if (fetchError) {
        return res.status(500).json({ message: fetchError.message });
    }

    if (!(payment_method in wallet)) {
        return res.status(400).json({ message: "Invalid payment method" });
    }

    const currentBalance = wallet[payment_method];

    if (currentBalance < total_amount) {
        return res.status(400).json({ message: "Insufficient balance" });
    }

    const newBalance = currentBalance - total_amount;

    const { data: updated, error: updateError } = await supabase
        .from(primaryTable)
        .update({
        [payment_method]: newBalance, 
        })
        .eq('user_id', user_id)
        .select()
        .single();

    if (updateError) {
        return res.status(500).json({ message: updateError.message });
    }

    return res.json({
        message: "Payment successful",
        updated,
    });
});



export default router;