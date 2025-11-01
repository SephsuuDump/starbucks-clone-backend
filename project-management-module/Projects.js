import express, {response} from 'express';
import { supabase } from "../config.js";
import { assertType } from 'graphql';


const router = express.Router();
const table = 'projects';
const responseFields = 'id, name, description, start_date, end_date, status, budget, actual_end'

router.post("/create", async (req, res) => {
    const {
        name, 
        description, 
        start_date, 
        end_date, 
        status,
        budget
    } = req.body

    try {

    const {data, error} = await supabase
    .from(table)
    .insert({
        name : name,
        description : description,
        start_date : start_date, 
        end_date : end_date, 
        status : status.toUpperCase(),
        budget : budget,
        is_deleted : false
    })
    .select(responseFields)
    .single()

    if(error) {
        return res.status(500).json({message: error.message})
    }

    return res.status(201).json(data); }
    catch(err) {
        return res.status(500).json({message : err.message})
    }

})

router.post("/update", async (req, res) => {
    const {id} = req.query;
    const {start_date, end_date, status, budget, actual_end} = req.body;

    if (!id)  {
        return res.status(500).json({message : "id is required"})
    }

     try {
        const {data : project, error : projectErr} = await supabase
        .from(table)
        .select(responseFields)
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle()

        if (projectErr ) {
            return  res.status(500).json({message : projectErr.message})
        }

        if (!project) {
            return res.status(404).json({message : "No project found"})
        }
        
        const isDone = status.toUpperCase() === "DONE";

        const {data, error} = await supabase
        .from(table)
        .update({
            start_date : start_date,
            end_date : end_date ,
            status : status.toUpperCase(),
            budget : budget,
            actual_end: isDone ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select(responseFields)

        
        if (error) {
            return  res.status(500).json({message : projectErr.message})
        }

        return res.status(200).json(data)




    } catch (err) {
          return  res.status(500).json({message : err.message})
    }
})

router.post("/delete-by-id" , async (req, res) => {
    const {id} = req.query;

    if (!id)  {
        return res.status(500).json({message : "id is required"})
    }

    try {
        const {data : project, error : projectErr} = await supabase
        .from(table)
        .select(responseFields)
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle()

        if (projectErr ) {
            return  res.status(500).json({message : projectErr.message})
        }

        if (!project) {
            return res.status(404).json({message : "No project found"})
        }

        const {data, error} = await supabase
        .from(table)
        .update({is_deleted : true})
        .eq("id", id)
        .select(responseFields)

        
        if (error) {
            return  res.status(500).json({message : projectErr.message})
        }

        return res.status(200).json({message: `Delete project ${data[0].name}`})


    } catch (err) {
          return  res.status(500).json({message : err.message})
    }
})

router.get("/get-all", async (req, res) => {
    try {
            const {data, error} = await supabase
            .from(table)
            .select(responseFields)
            .eq('is_deleted', false)


            if(error) {return res.status(500).json({message : error.message})}

            return res.status(200).json(data)
    } catch(err) {
        return res.status(500).json({message : err.message})
    }
})

router.get("/get-by-id", async (req, res) => {
    const {id} = req.query;

    const {data, error } = await supabase
    .from(table)
    .select(responseFields)
    .eq('id', id)
    .maybeSingle()

    if(error) {return res.status(500).json({message : error.message})}

    return res.status(200).json(data);
})

export default router;

