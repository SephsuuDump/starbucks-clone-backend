import express from "express";
import { supabase } from "../config.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();
const table = '_users';

router.get("/google-login", async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
    });

    if (error) return res.status(400).json({ error: error.message });
    res.redirect(data.url);
});

router.post("/oauth-login", async (req, res) => {    
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
                    email: existing.email 
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

        res.json({ message: "User created", user: newUser })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('email', email)
    .single();

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
            role: data.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json(token);
})

router.post("/signup", async (req, res) => {
    const { email, password } = req.body;
    
    const { data: existing, error: findError } = await supabase
    .from(table)
    .select('*')
    .eq('email', email)
    .maybeSingle();

    const hashedPassword = await bcrypt.hash(password, 12);

    if (findError) return res.status(500).json({ error: findError.message });
    if (existing) return res.status(400).json({ message: "Email is already used." });

    const { data, error } = await supabase
    .from(table)
    .insert({ email, password: hashedPassword })
    .select('*')
    .single();    

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json(data);
});

export default router;
