import { createClient } from '@supabase/supabase-js';

const url = 'https://ehypasmwglaonikeguwh.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.JWT;

if (!url || !key) {
  throw new Error('Supabase configuration is missing. Check the connected Supabase integration.');
}

export const supabase = createClient(url, key);
