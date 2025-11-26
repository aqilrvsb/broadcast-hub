import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ubfmnynwmvxfkwfxshuv.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZm1ueW53bXZ4Zmt3ZnhzaHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjIyMTIsImV4cCI6MjA3OTY5ODIxMn0.sN5tA1dxUbYIdtbjUybrIrxAu3EXjZESDYfXU1MrduE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
