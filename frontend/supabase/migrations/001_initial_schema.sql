-- GraphSense Database Schema
-- This file contains the complete database schema for the application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create datasets table
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_analyses table
CREATE TABLE agent_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,
    analysis_data JSONB NOT NULL DEFAULT '{}',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    processing_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visualizations table
CREATE TABLE visualizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    chart_type VARCHAR(50) NOT NULL,
    chart_config JSONB NOT NULL DEFAULT '{}',
    title VARCHAR(255),
    description TEXT,
    is_shared BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_datasets_user_id ON datasets(user_id);
CREATE INDEX idx_datasets_processing_status ON datasets(processing_status);
CREATE INDEX idx_datasets_created_at ON datasets(created_at DESC);

CREATE INDEX idx_agent_analyses_dataset_id ON agent_analyses(dataset_id);
CREATE INDEX idx_agent_analyses_agent_type ON agent_analyses(agent_type);
CREATE INDEX idx_agent_analyses_created_at ON agent_analyses(created_at);

CREATE INDEX idx_visualizations_user_id ON visualizations(user_id);
CREATE INDEX idx_visualizations_dataset_id ON visualizations(dataset_id);
CREATE INDEX idx_visualizations_share_token ON visualizations(share_token);
CREATE INDEX idx_visualizations_created_at ON visualizations(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visualizations_updated_at BEFORE UPDATE ON visualizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizations ENABLE ROW LEVEL SECURITY;

-- Datasets policies
CREATE POLICY "Users can view own datasets" ON datasets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own datasets" ON datasets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own datasets" ON datasets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own datasets" ON datasets
    FOR DELETE USING (auth.uid() = user_id);

-- Agent analyses policies (linked to datasets)
CREATE POLICY "Users can view analyses of own datasets" ON agent_analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM datasets
            WHERE datasets.id = agent_analyses.dataset_id
            AND datasets.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert agent analyses" ON agent_analyses
    FOR INSERT WITH CHECK (true); -- Allow service role to insert

-- Visualizations policies
CREATE POLICY "Users can view own visualizations" ON visualizations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared visualizations" ON visualizations
    FOR SELECT USING (is_shared = true);

CREATE POLICY "Users can insert own visualizations" ON visualizations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visualizations" ON visualizations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own visualizations" ON visualizations
    FOR DELETE USING (auth.uid() = user_id);

-- Function to generate share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ language 'plpgsql';

-- Function to update share token when visualization is shared
CREATE OR REPLACE FUNCTION update_share_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_shared = true AND (OLD.is_shared = false OR OLD.share_token IS NULL) THEN
        NEW.share_token = generate_share_token();
    ELSIF NEW.is_shared = false THEN
        NEW.share_token = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_share_token BEFORE INSERT OR UPDATE ON visualizations
    FOR EACH ROW EXECUTE FUNCTION update_share_token();