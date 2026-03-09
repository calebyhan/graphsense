-- GraphSense Database Schema
-- Supabase PostgreSQL Schema

-- ============================================================
-- Hard Reset: Drop everything in reverse dependency order
-- ============================================================

-- Functions
DROP FUNCTION IF EXISTS join_canvas_via_token(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS user_has_canvas_edit(UUID) CASCADE;
DROP FUNCTION IF EXISTS user_has_canvas_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_generate_share_token() CASCADE;
DROP FUNCTION IF EXISTS generate_share_token() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Tables (reverse FK order)
DROP TABLE IF EXISTS canvas_collaborators CASCADE;
DROP TABLE IF EXISTS canvas_datasets CASCADE;
DROP TABLE IF EXISTS canvases CASCADE;
DROP TABLE IF EXISTS visualizations CASCADE;
DROP TABLE IF EXISTS agent_analyses CASCADE;
DROP TABLE IF EXISTS datasets CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- Schema
-- ============================================================

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

-- Profiles table (display_name + avatar_color per user)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(50) NOT NULL CHECK (char_length(trim(display_name)) >= 2),
    avatar_color CHAR(7) NOT NULL DEFAULT '#4F46E5' CHECK (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

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
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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

-- ============================================================
-- Canvas Collaboration Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS canvases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    share_token VARCHAR(64) UNIQUE,
    share_permission VARCHAR(4) CHECK (share_permission IN ('view', 'edit')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT share_fields_consistent CHECK (
        (share_token IS NULL AND share_permission IS NULL) OR
        (share_token IS NOT NULL AND share_permission IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS canvas_datasets (
    canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (canvas_id, dataset_id)
);

CREATE TABLE IF NOT EXISTS canvas_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission VARCHAR(4) NOT NULL CHECK (permission IN ('view', 'edit')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (canvas_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_canvases_owner_id ON canvases(owner_id);
CREATE INDEX IF NOT EXISTS idx_canvases_share_token ON canvases(share_token);

CREATE INDEX IF NOT EXISTS idx_canvas_datasets_canvas_id ON canvas_datasets(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_datasets_dataset_id ON canvas_datasets(dataset_id);

CREATE INDEX IF NOT EXISTS idx_canvas_collaborators_canvas_id ON canvas_collaborators(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_collaborators_user_id ON canvas_collaborators(user_id);

-- Trigger: updated_at for canvases
CREATE TRIGGER update_canvases_updated_at
    BEFORE UPDATE ON canvases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION user_has_canvas_access(p_canvas_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM canvases WHERE id = p_canvas_id AND owner_id = auth.uid()
        UNION
        SELECT 1 FROM canvas_collaborators WHERE canvas_id = p_canvas_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_canvas_edit(p_canvas_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM canvases WHERE id = p_canvas_id AND owner_id = auth.uid()
        UNION
        SELECT 1 FROM canvas_collaborators
        WHERE canvas_id = p_canvas_id AND user_id = auth.uid() AND permission = 'edit'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- join_canvas_via_token: SECURITY DEFINER so users cannot bypass RLS to self-insert
CREATE OR REPLACE FUNCTION join_canvas_via_token(p_token VARCHAR(64))
RETURNS TABLE(canvas_id UUID, permission VARCHAR(4)) AS $$
DECLARE
    v_canvas_id UUID;
    v_permission VARCHAR(4);
BEGIN
    SELECT id, share_permission INTO v_canvas_id, v_permission
    FROM canvases
    WHERE share_token = p_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired share token';
    END IF;

    IF EXISTS (SELECT 1 FROM canvases WHERE id = v_canvas_id AND owner_id = auth.uid()) THEN
        RETURN QUERY SELECT v_canvas_id, v_permission;
        RETURN;
    END IF;

    INSERT INTO canvas_collaborators (canvas_id, user_id, permission)
    VALUES (v_canvas_id, auth.uid(), v_permission)
    ON CONFLICT (canvas_id, user_id) DO NOTHING;

    RETURN QUERY SELECT v_canvas_id, v_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- canvases policies
CREATE POLICY "Canvas access: owner and collaborators"
    ON canvases FOR SELECT
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM canvas_collaborators
            WHERE canvas_id = canvases.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Canvas insert: owner only"
    ON canvases FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Canvas update: owner only"
    ON canvases FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Canvas delete: owner only"
    ON canvases FOR DELETE
    USING (owner_id = auth.uid());

-- canvas_datasets policies
CREATE POLICY "canvas_datasets select: canvas access"
    ON canvas_datasets FOR SELECT
    USING (user_has_canvas_access(canvas_id));

CREATE POLICY "canvas_datasets insert: edit access"
    ON canvas_datasets FOR INSERT
    WITH CHECK (
        user_has_canvas_edit(canvas_id)
        AND EXISTS (
            SELECT 1 FROM datasets WHERE id = dataset_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "canvas_datasets delete: edit access"
    ON canvas_datasets FOR DELETE
    USING (user_has_canvas_edit(canvas_id));

-- SECURITY DEFINER helper so canvas_collaborators SELECT policy can check canvas
-- ownership without triggering canvases RLS (which queries canvas_collaborators,
-- which would re-enter this policy → infinite recursion).
CREATE OR REPLACE FUNCTION is_canvas_owner(p_canvas_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM canvases WHERE id = p_canvas_id AND owner_id = auth.uid()
    )
$$ LANGUAGE SQL SECURITY DEFINER;

-- canvas_collaborators policies
CREATE POLICY "canvas_collaborators select"
    ON canvas_collaborators FOR SELECT
    USING (
        user_id = auth.uid() OR
        is_canvas_owner(canvas_id)
    );

CREATE POLICY "canvas_collaborators delete: owner only"
    ON canvas_collaborators FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM canvases WHERE id = canvas_id AND owner_id = auth.uid())
    );

-- Extended datasets policies for canvas collaborators
CREATE POLICY "Datasets: canvas collaborator read access"
    ON datasets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM canvas_datasets cd
            JOIN canvas_collaborators cc ON cc.canvas_id = cd.canvas_id
            WHERE cd.dataset_id = datasets.id AND cc.user_id = auth.uid()
        )
    );

-- Extended visualizations policies for canvas collaborators
CREATE POLICY "Visualizations: canvas collaborator read"
    ON visualizations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM canvas_datasets cd
            JOIN canvas_collaborators cc ON cc.canvas_id = cd.canvas_id
            WHERE cd.dataset_id = visualizations.dataset_id AND cc.user_id = auth.uid()
        )
    );

CREATE POLICY "Visualizations: canvas collaborator insert"
    ON visualizations FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM canvas_datasets cd
            WHERE cd.dataset_id = visualizations.dataset_id
            AND user_has_canvas_edit(cd.canvas_id)
        )
    );

CREATE POLICY "Visualizations: canvas collaborator update"
    ON visualizations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM canvas_datasets cd
            WHERE cd.dataset_id = visualizations.dataset_id
            AND user_has_canvas_edit(cd.canvas_id)
        )
    );

-- Extended agent_analyses policies for canvas collaborators
CREATE POLICY "Agent analyses: canvas collaborator read"
    ON agent_analyses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM canvas_datasets cd
            JOIN canvas_collaborators cc ON cc.canvas_id = cd.canvas_id
            WHERE cd.dataset_id = agent_analyses.dataset_id AND cc.user_id = auth.uid()
        )
    );

-- Note: Profile rows are created client-side on first login via useProfile hook,
-- seeded from user_metadata set during signup.