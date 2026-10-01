import { createClient } from '@supabase/supabase-js';

const url = 'https://ehypasmwglaonikeguwh.supabase.co';
const key = import.meta.env.JWT_2 || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.JWT;

// Keep the preview renderable if the connected integration has not injected its
// public key yet. Supabase requests will fail gracefully until the key is available.
export const supabase = createClient(url, key || 'preview-anon-key-unavailable');
