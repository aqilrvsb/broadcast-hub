-- WhatsApp Analytics Broadcast System - Database Setup
-- Run this SQL in your Supabase SQL Editor (https://hxplutdgulpnzkhdydqh.supabase.co)

-- Create profiles table to store user registration data
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  full_name text,
  username text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  primary key (id)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- RLS Policies for profiles table
-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Allow users to insert their own profile
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Function to handle new user registration
-- This automatically creates a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username'
  );
  return new;
end;
$$;

-- Trigger to automatically create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Index for faster username lookups
create index profiles_username_idx on public.profiles(username);
