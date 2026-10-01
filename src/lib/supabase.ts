import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ehypasmwglaonikeguwh.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.JWT;

// Use only publishable/anon client credentials in the browser; secret/service-role keys must stay server-side.
if (!key) {
  throw new Error('Supabase anon key is not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url, key);
