import { createClient } from "@supabase/supabase-js";
import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json());

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);