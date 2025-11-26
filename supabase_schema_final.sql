-- ================================================
-- CHATBOT AUTOMATION PLATFORM - DATABASE SCHEMA
-- ================================================
-- Version: 3.0 - Latest Production Schema
-- ================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLE: packages (must be created first - referenced by user)
-- ================================================
CREATE TABLE public.packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  price numeric NOT NULL,
  currency character varying DEFAULT 'MYR'::character varying,
  duration_days integer NOT NULL DEFAULT 30,
  max_devices integer NOT NULL DEFAULT 1,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT packages_pkey PRIMARY KEY (id)
);

-- ================================================
-- TABLE: user
-- ================================================
CREATE TABLE public.user (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  full_name character varying NOT NULL,
  gmail character varying,
  phone character varying,
  status character varying DEFAULT 'Trial'::character varying,
  expired character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_login timestamp with time zone,
  package_id uuid,
  subscription_status character varying DEFAULT 'inactive'::character varying,
  subscription_start timestamp with time zone,
  subscription_end timestamp with time zone,
  max_devices integer DEFAULT 1,
  role character varying DEFAULT 'user'::character varying,
  password character varying,
  CONSTRAINT user_pkey PRIMARY KEY (id),
  CONSTRAINT user_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id)
);

CREATE INDEX IF NOT EXISTS user_email_idx ON public.user(email);

-- ================================================
-- TABLE: device_setting
-- ================================================
CREATE TABLE public.device_setting (
  id character varying NOT NULL,
  device_id character varying,
  instance text,
  webhook_id character varying,
  provider character varying DEFAULT 'waha'::character varying CHECK (provider::text = ANY (ARRAY['whacenter'::character varying, 'wablas'::character varying, 'waha'::character varying]::text[])),
  api_key_option character varying DEFAULT 'openai/gpt-4.1'::character varying CHECK (api_key_option::text = ANY (ARRAY['openai/gpt-5-chat'::character varying, 'openai/gpt-5-mini'::character varying, 'openai/chatgpt-4o-latest'::character varying, 'openai/gpt-4.1'::character varying, 'google/gemini-2.5-pro'::character varying, 'google/gemini-pro-1.5'::character varying]::text[])),
  api_key text,
  id_device character varying,
  id_erp character varying,
  id_admin character varying,
  phone_number character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  status character varying DEFAULT 'UNKNOWN'::character varying,
  CONSTRAINT device_setting_pkey PRIMARY KEY (id),
  CONSTRAINT fk_device_setting_user FOREIGN KEY (user_id) REFERENCES public.user(id)
);

CREATE INDEX IF NOT EXISTS device_setting_device_id_idx ON public.device_setting(device_id);
CREATE INDEX IF NOT EXISTS device_setting_provider_idx ON public.device_setting(provider);
CREATE INDEX IF NOT EXISTS device_setting_user_id_idx ON public.device_setting(user_id);

-- ================================================
-- TABLE: chatbot_flows
-- ================================================
CREATE TABLE public.chatbot_flows (
  id character varying NOT NULL,
  id_device character varying NOT NULL DEFAULT ''::character varying,
  name character varying NOT NULL,
  niche character varying NOT NULL DEFAULT ''::character varying,
  nodes jsonb,
  edges jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  nodes_data text,
  CONSTRAINT chatbot_flows_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS chatbot_flows_id_device_idx ON public.chatbot_flows(id_device);

-- ================================================
-- TABLE: ai_whatsapp
-- ================================================
CREATE TABLE public.ai_whatsapp (
  id_prospect serial NOT NULL,
  device_id character varying,
  niche character varying,
  prospect_name character varying,
  prospect_num character varying UNIQUE,
  intro character varying,
  stage character varying,
  conv_last text,
  conv_current text,
  human integer DEFAULT 0,
  date_insert date DEFAULT CURRENT_DATE,
  user_id uuid,
  detail text,
  sequence_stage character varying,
  CONSTRAINT ai_whatsapp_pkey PRIMARY KEY (id_prospect),
  CONSTRAINT ai_whatsapp_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user(id)
);

CREATE INDEX IF NOT EXISTS ai_whatsapp_prospect_num_idx ON public.ai_whatsapp(prospect_num);
CREATE INDEX IF NOT EXISTS ai_whatsapp_device_id_idx ON public.ai_whatsapp(device_id);
CREATE INDEX IF NOT EXISTS ai_whatsapp_stage_idx ON public.ai_whatsapp(stage);
CREATE INDEX IF NOT EXISTS ai_whatsapp_human_idx ON public.ai_whatsapp(human);

-- ================================================
-- TABLE: wasapbot
-- ================================================
CREATE TABLE public.wasapbot (
  id_prospect serial NOT NULL,
  execution_status character varying CHECK (execution_status::text = ANY (ARRAY['active'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  flow_id character varying,
  current_node_id character varying,
  last_node_id character varying,
  waiting_for_reply boolean DEFAULT false,
  id_device character varying,
  prospect_num character varying,
  niche character varying,
  peringkat_sekolah character varying,
  alamat character varying,
  prospect_name character varying,
  pakej character varying,
  no_fon character varying,
  cara_bayaran character varying,
  tarikh_gaji character varying,
  stage character varying,
  conv_current character varying,
  conv_last text,
  created_at character varying,
  updated_at character varying,
  status character varying DEFAULT 'Prospek'::character varying,
  CONSTRAINT wasapbot_pkey PRIMARY KEY (id_prospect)
);

CREATE INDEX IF NOT EXISTS wasapbot_prospect_num_idx ON public.wasapbot(prospect_num);
CREATE INDEX IF NOT EXISTS wasapbot_id_device_idx ON public.wasapbot(id_device);

-- ================================================
-- TABLE: stagesetvalue
-- ================================================
CREATE TABLE public.stagesetvalue (
  stagesetvalue_id serial NOT NULL,
  id_device character varying,
  stage character varying,
  type_inputdata character varying,
  columnsdata character varying,
  inputhardcode character varying,
  CONSTRAINT stagesetvalue_pkey PRIMARY KEY (stagesetvalue_id)
);

CREATE INDEX IF NOT EXISTS stagesetvalue_device_idx ON public.stagesetvalue(id_device);

-- ================================================
-- TABLE: orders
-- ================================================
CREATE TABLE public.orders (
  id serial NOT NULL,
  user_id uuid,
  collection_id character varying,
  bill_id character varying,
  product character varying NOT NULL,
  method character varying DEFAULT 'billplz'::character varying CHECK (method::text = ANY (ARRAY['billplz'::character varying, 'cod'::character varying]::text[])),
  amount numeric NOT NULL,
  status character varying DEFAULT 'Pending'::character varying CHECK (status::text = ANY (ARRAY['Pending'::character varying, 'Processing'::character varying, 'Success'::character varying, 'Failed'::character varying]::text[])),
  url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES public.user(id)
);

CREATE INDEX IF NOT EXISTS orders_bill_id_idx ON public.orders(bill_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);

-- ================================================
-- TABLE: payments
-- ================================================
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid,
  amount numeric NOT NULL,
  currency character varying DEFAULT 'MYR'::character varying,
  status character varying DEFAULT 'pending'::character varying,
  chip_purchase_id character varying,
  chip_transaction_id character varying,
  chip_checkout_url text,
  paid_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user(id),
  CONSTRAINT payments_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id)
);

-- ================================================
-- TABLE: bank_images
-- ================================================
CREATE TABLE public.bank_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  image_url text NOT NULL,
  blob_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bank_images_pkey PRIMARY KEY (id),
  CONSTRAINT bank_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user(id)
);

-- ================================================
-- TABLE: prompts
-- ================================================
CREATE TABLE public.prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id character varying NOT NULL,
  niche character varying NOT NULL,
  prompts_name character varying NOT NULL,
  prompts_data text NOT NULL,
  user_id uuid NOT NULL,
  created_at date NOT NULL DEFAULT CURRENT_DATE,
  updated_at date NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT prompts_pkey PRIMARY KEY (id),
  CONSTRAINT prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user(id)
);

-- ================================================
-- TABLE: sequences
-- ================================================
CREATE TABLE public.sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  niche character varying NOT NULL,
  trigger character varying NOT NULL,
  description text NOT NULL,
  schedule_time character varying NOT NULL DEFAULT '09:00'::character varying,
  min_delay integer NOT NULL DEFAULT 5,
  max_delay integer NOT NULL DEFAULT 15,
  status character varying NOT NULL DEFAULT 'inactive'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequences_pkey PRIMARY KEY (id),
  CONSTRAINT sequences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user(id)
);

-- ================================================
-- TABLE: sequence_flows
-- ================================================
CREATE TABLE public.sequence_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL,
  flow_number integer NOT NULL,
  step_trigger character varying NOT NULL,
  next_trigger character varying,
  delay_hours integer NOT NULL DEFAULT 24,
  message text NOT NULL,
  image_url text,
  is_end boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequence_flows_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_flows_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id)
);

-- ================================================
-- TABLE: sequence_enrollments
-- ================================================
CREATE TABLE public.sequence_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL,
  prospect_num character varying NOT NULL,
  current_flow_number integer NOT NULL DEFAULT 1,
  status character varying NOT NULL DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_sent_at timestamp with time zone,
  next_message_scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  schedule_message timestamp with time zone,
  CONSTRAINT sequence_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id)
);

-- ================================================
-- TABLE: sequence_scheduled_messages
-- ================================================
CREATE TABLE public.sequence_scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  sequence_id uuid NOT NULL,
  flow_number integer NOT NULL,
  prospect_num character varying NOT NULL,
  device_id character varying NOT NULL,
  whacenter_message_id character varying,
  message text NOT NULL,
  image_url text,
  scheduled_time timestamp with time zone NOT NULL,
  status character varying NOT NULL DEFAULT 'scheduled'::character varying CHECK (status::text = ANY (ARRAY['scheduled'::character varying::text, 'sent'::character varying::text, 'cancelled'::character varying::text, 'failed'::character varying::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequence_scheduled_messages_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_scheduled_messages_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.sequence_enrollments(id),
  CONSTRAINT sequence_scheduled_messages_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id)
);

-- ================================================
-- TABLE: processing_tracker
-- ================================================
CREATE TABLE public.processing_tracker (
  id bigserial NOT NULL,
  id_prospect character varying,
  flow_type character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT processing_tracker_pkey PRIMARY KEY (id)
);

-- ================================================
-- FUNCTIONS: update_updated_at_column
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER update_user_updated_at
BEFORE UPDATE ON public.user
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_setting_updated_at
BEFORE UPDATE ON public.device_setting
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chatbot_flows_updated_at
BEFORE UPDATE ON public.chatbot_flows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wasapbot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stagesetvalue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_tracker ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service role full access" ON public.user FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.device_setting FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.chatbot_flows FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.orders FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ai_whatsapp FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.wasapbot FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.stagesetvalue FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.packages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.payments FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.bank_images FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.prompts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.sequences FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.sequence_flows FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.sequence_enrollments FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.sequence_scheduled_messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.processing_tracker FOR ALL USING (true);

-- ================================================
-- SAMPLE DATA: Default Packages
-- ================================================
INSERT INTO public.packages (name, description, price, currency, duration_days, max_devices, features, is_active)
VALUES
  ('Free', 'Free trial package', 0, 'MYR', 7, 1, '["1 Device", "Basic Support"]', true),
  ('Basic', 'Basic package for small businesses', 49, 'MYR', 30, 3, '["3 Devices", "Email Support", "Basic Analytics"]', true),
  ('Pro', 'Professional package', 99, 'MYR', 30, 10, '["10 Devices", "Priority Support", "Advanced Analytics", "Custom Flows"]', true),
  ('Enterprise', 'Enterprise package for large businesses', 299, 'MYR', 30, 100, '["Unlimited Devices", "24/7 Support", "Full Analytics", "Custom Integration", "API Access"]', true)
ON CONFLICT DO NOTHING;
