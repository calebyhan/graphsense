-- Function to create test user if it doesn't exist
-- This helps with integration testing by ensuring a test user exists

CREATE OR REPLACE FUNCTION create_test_user_if_not_exists(
    user_id UUID,
    user_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert into auth.users if not exists
    INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        email_confirmed_at
    ) VALUES (
        user_id,
        'authenticated',
        'authenticated', 
        user_email,
        '{"provider": "email", "providers": ["email"]}',
        '{"name": "Test User"}',
        NOW(),
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_test_user_if_not_exists(UUID, TEXT) TO service_role;