import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = () => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      get(name: string) {
        try {
          return (cookies() as any).get(name)?.value;
        } catch {
          return undefined;
        }
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          (cookies() as any).set(name, value, options);
        } catch {
          // Called in a Server Component — safe to ignore when middleware handles session refresh.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          (cookies() as any).set(name, '', { ...(options as any), maxAge: 0 });
        } catch {
          // As above
        }
      },
    },
  });
};
