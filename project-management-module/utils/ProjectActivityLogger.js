import { supabase } from "../../config.js";

export async function logProjectActivity({
  project_id,
  actor_id = null,
  actor_role,
  entity_type,
  entity_id = null,
  action,
  description,
}) {
  try {
    await supabase.from("project_activity_logs").insert({
      project_id,
      actor_id,
      actor_role,
      entity_type,
      entity_id,
      action,
      description,
    });
  } catch (err) {
    console.error("Project activity log failed:", err.message);
  }
}
