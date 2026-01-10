import express from "express"; // import express router
import { supabase } from "../config.js"; // import supabase client

const router = express.Router(); // initialize router
const table = "project_activity_logs"; // activity logs table name

router.get("/get-by-project", async (req, res) => { // endpoint to fetch logs per project
  const { project_id } = req.query; // extract project id from query

  if (!project_id) { // validate required project id
    return res.status(400).json({ message: "project_id is required" }); // return error if missing
  }

  try {
    const { data, error } = await supabase // query supabase
      .from(table) // select from activity logs table
      .select(`
        id,
        project_id,
        actor_id,
        actor_role,
        entity_type,
        entity_id,
        action,
        description,
        created_at
      `) // select timeline fields
      .eq("project_id", project_id) // filter by project
      .order("created_at", { ascending: false }); // order by latest first

    if (error) { // handle query error
      return res.status(500).json({ message: error.message }); // return error response
    }

    return res.status(200).json({ data }); // return activity logs
  } catch (err) {
    return res.status(500).json({ message: err.message }); // catch unexpected errors
  }
});

export default router; // export router
