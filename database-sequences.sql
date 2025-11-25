-- Create sequences table
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  trigger TEXT NOT NULL,
  description TEXT NOT NULL,
  min_delay INTEGER NOT NULL DEFAULT 5,
  max_delay INTEGER NOT NULL DEFAULT 15,
  schedule_time TIME NOT NULL DEFAULT '09:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  contacts_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequence_flows table
CREATE TABLE IF NOT EXISTS sequence_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  flow_number INTEGER NOT NULL,
  step_trigger TEXT NOT NULL,
  next_trigger TEXT,
  delay_hours INTEGER NOT NULL DEFAULT 24,
  message TEXT NOT NULL,
  image_url TEXT,
  is_end BOOLEAN NOT NULL DEFAULT false,
  continue_to_sequence UUID REFERENCES sequences(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sequence_id, flow_number)
);

-- Enable RLS
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_flows ENABLE ROW LEVEL SECURITY;

-- Create policies for sequences
CREATE POLICY "Users can view their own sequences"
  ON sequences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sequences"
  ON sequences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sequences"
  ON sequences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sequences"
  ON sequences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for sequence_flows
CREATE POLICY "Users can view flows of their sequences"
  ON sequence_flows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sequences
      WHERE sequences.id = sequence_flows.sequence_id
      AND sequences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert flows for their sequences"
  ON sequence_flows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sequences
      WHERE sequences.id = sequence_flows.sequence_id
      AND sequences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update flows of their sequences"
  ON sequence_flows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sequences
      WHERE sequences.id = sequence_flows.sequence_id
      AND sequences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete flows of their sequences"
  ON sequence_flows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sequences
      WHERE sequences.id = sequence_flows.sequence_id
      AND sequences.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_sequences_user_id ON sequences(user_id);
CREATE INDEX idx_sequence_flows_sequence_id ON sequence_flows(sequence_id);
