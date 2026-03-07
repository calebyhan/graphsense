-- GraphSense Database Schema
-- Supabase PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table is managed by Supabase Auth
-- No need to create it explicitly

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    processing_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    data_profile JSONB,
    sample_data JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent analyses table
CREATE TABLE IF NOT EXISTS agent_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    agent_type VARCHAR(20) NOT NULL CHECK (agent_type IN ('profiler', 'recommender', 'validator')),
    analysis_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visualizations table
CREATE TABLE IF NOT EXISTS visualizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    chart_type VARCHAR(20) NOT NULL CHECK (chart_type IN ('bar', 'line', 'scatter', 'pie', 'histogram', 'box_plot', 'heatmap', 'area', 'treemap', 'sankey')),
    chart_config JSONB NOT NULL,
    title VARCHAR(255),
    description TEXT,
    is_shared BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(32) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_processing_status ON datasets(processing_status);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_analyses_dataset_id ON agent_analyses(dataset_id);
CREATE INDEX IF NOT EXISTS idx_agent_analyses_agent_type ON agent_analyses(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_analyses_created_at ON agent_analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_visualizations_dataset_id ON visualizations(dataset_id);
CREATE INDEX IF NOT EXISTS idx_visualizations_user_id ON visualizations(user_id);
CREATE INDEX IF NOT EXISTS idx_visualizations_share_token ON visualizations(share_token);
CREATE INDEX IF NOT EXISTS idx_visualizations_created_at ON visualizations(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizations ENABLE ROW LEVEL SECURITY;

-- Datasets policies
CREATE POLICY "Users can view their own datasets"
    ON datasets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view anonymous datasets"
    ON datasets FOR SELECT
    USING (user_id IS NULL);

CREATE POLICY "Users can insert their own datasets"
    ON datasets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can insert anonymous datasets"
    ON datasets FOR INSERT
    WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can update their own datasets"
    ON datasets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own datasets"
    ON datasets FOR DELETE
    USING (auth.uid() = user_id);

-- Agent analyses policies (linked to dataset ownership)
CREATE POLICY "Users can view analyses for their datasets"
    ON agent_analyses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM datasets
            WHERE datasets.id = agent_analyses.dataset_id
            AND datasets.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert agent analyses"
    ON agent_analyses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM datasets
            WHERE datasets.id = agent_analyses.dataset_id
        )
    );

-- Visualizations policies
CREATE POLICY "Users can view their own visualizations"
    ON visualizations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared visualizations"
    ON visualizations FOR SELECT
    USING (is_shared = true);

CREATE POLICY "Users can insert their own visualizations"
    ON visualizations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visualizations"
    ON visualizations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visualizations"
    ON visualizations FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_datasets_updated_at
    BEFORE UPDATE ON datasets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visualizations_updated_at
    BEFORE UPDATE ON visualizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate share token when is_shared is set to true
CREATE OR REPLACE FUNCTION auto_generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_shared = true AND (OLD.is_shared = false OR OLD.is_shared IS NULL) THEN
        NEW.share_token = generate_share_token();
    ELSIF NEW.is_shared = false THEN
        NEW.share_token = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_share_token_trigger
    BEFORE UPDATE ON visualizations
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_share_token();