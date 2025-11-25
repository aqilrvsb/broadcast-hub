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

-- Create devices table to store WhatsApp devices
create table public.devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_name text not null,
  phone_number text not null,
  device_id text unique,
  status text default 'NOT CONNECTED',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, device_name)
);

-- Enable Row Level Security
alter table public.devices enable row level security;

-- RLS Policies for devices table
-- Users can view their own devices
create policy "Users can view own devices"
  on public.devices
  for select
  using (auth.uid() = user_id);

-- Users can insert their own devices
create policy "Users can insert own devices"
  on public.devices
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own devices
create policy "Users can update own devices"
  on public.devices
  for update
  using (auth.uid() = user_id);

-- Users can delete their own devices
create policy "Users can delete own devices"
  on public.devices
  for delete
  using (auth.uid() = user_id);

-- Index for faster device lookups
create index devices_user_id_idx on public.devices(user_id);
create index devices_device_id_idx on public.devices(device_id);
