import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ehypasmwglaonikeguwh.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Use only publishable client credentials in the browser; secret/service-role keys must stay server-side.
export const supabase = createClient(url, key || 'preview-anon-key-unavailable');
