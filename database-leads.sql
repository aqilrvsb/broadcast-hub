-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  niche TEXT,
  status TEXT NOT NULL DEFAULT 'prospect',
  trigger TEXT,
  additional_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS leads_user_id_idx ON public.leads(user_id);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
  ON public.leads FOR DELETE
  USING (auth.uid() = user_id);
