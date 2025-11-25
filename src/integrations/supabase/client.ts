import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hxplutdgulpnzkhdydqh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4cGx1dGRndWxwbnpraGR5ZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTA4MTUsImV4cCI6MjA3OTYyNjgxNX0.T6_fHa2pWbw83hJf0Eyk92Ho1L4EpdEeaq-GBkDr4Qo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
