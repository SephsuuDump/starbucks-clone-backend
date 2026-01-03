import express from "express";
import { supabase } from "../config.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();
const table = '_users';

router.get("/google-login", async (req, res) => {
    console.log("IN");
    
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${process.env.NEXT_PUBLIC_API_URL}/auth/callback` },
    });

    if (error) return res.status(400).json({ error: error.message });
    res.redirect(data.url);
});

router.post("/oauth-login", async (req, res) => {   
    console.log('IN') 
    const { email, provider, external_id } = req.body

    if (!email) return res.status(400).json({ error: "Email required" })

    try {
        const { data: existing } = await supabase
        .from(table)
        .select("*")
        .eq("email", email)
        .single()

        if (existing) {
            const token = jwt.sign(
                { 
                    id: existing.id, 
                    email: existing.email,
                    role: "CUSTOMER" 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );            
            return res.status(200).json(token);
        }

        const randomPassword = Math.random().toString(36).slice(-8)
        const hashedPassword = await bcrypt.hash(randomPassword, 10)

        const { data: newUser, error } = await supabase
        .from(table)
        .insert({
            email,
            password: hashedPassword,
            provider,    
            external_id,   
        })
        .select()
        .single()        

        if (error) throw error

        const { data: creditData, error: creditError } = await supabase
        .from("account_credit")
        .insert({
            user_id: newUser.id,   
        });

        if (creditError) return res.status(500).json({
            error: "User created but customer entry failed: " + customerError.message ?? creditError.message,
        });        

        const customerData = await fetch(
            `${process.env.NEST_PUBLIC_API_URL}/customers/create`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: newUser.id })
            }
        )        

        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email,
                role: "CUSTOMER" 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );            

        return res.status(200).json(token);
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase
    .from(table)
    .select('*, employee(*)')
    .eq('email', email)
    .single();
    console.log(data);
    

    if (!data) return res.status(400).json({ message: "Invalid username" });
    if (error) return res.status(500).json({ message: error.message });

    const matchPassword = await bcrypt.compare(password, data.password);

    if (!matchPassword) {
        return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
        { 
            id: data.id, 
            email: data.email,
            role: data.role,
            branchId: "0b0f48e1-6866-4776-9ce9-31309f5f4dbe",
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json(token);
})

router.post("/signup", async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const { data: existing, error: findError } = await supabase
            .from(table)
            .select("*")
            .eq("email", email)
            .maybeSingle();

        if (findError) return res.status(500).json({ error: findError.message });
        if (existing) return res.status(400).json({ message: "Email is already used." });

        const hashedPassword = await bcrypt.hash(password, 12);

        const { data: user, error: userError } = await supabase
            .from(table)
            .insert({ email, password: hashedPassword, role })
            .select("*")
            .single();

        if (userError) return res.status(500).json({ error: userError.message });

        if (role === "SUPPLIER") {
            const { error: supplierError } = await supabase
                .from("supplier")
                .insert({
                    user_id: user.id,  
                });

            if (supplierError) {
                return res.status(500).json({
                    error: "User created but supplier entry failed: " + supplierError.message,
                });
            }
        } else if (role === "CUSTOMER") {
            const { error: customerError } = await supabase
                .from("customers")
                .insert({
                    user_id: user.id,   
                });

            const { error: creditError } = await supabase
                .from("account_credit")
                .insert({
                    user_id: user.id,   
                });

            if (customerError || creditError) {
                return res.status(500).json({
                    error: "User created but customer entry failed: " + customerError.message ?? creditError.message,
                });
            }
        } 

        return res.status(201).json(user);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


export default router;
