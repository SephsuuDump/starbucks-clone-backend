import { createClient } from "@supabase/supabase-js";
import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json());

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
export const BASE_URL = `http://localhost:4000`;

export async function requestData(url, method, header = { 'Content-Type': 'application/json' }, body = null) {
    const res = await fetch(
        url,
        {
            method: method,
            headers: header,
            body: body,
        }
    );
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Something went wrong.');
    }

    return await res.json()
}