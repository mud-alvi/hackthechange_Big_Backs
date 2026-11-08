import {createHandler} from "./handler.ts";

Deno.serve(createHandler({supabaseUrl: Deno.env.get("SUPABASE_URL") || "",supabaseKey: Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",openaiKey: Deno.env.get("OPENAI_API_KEY") || "",model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini"}));
