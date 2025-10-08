
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createBrowserClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: true, autoRefreshToken: true },
});
