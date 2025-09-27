-- Setup test data for integration tests
-- This creates a test user that can be used for anonymous/testing purposes

-- Insert test user with the UUID used in the backend
INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    email_confirmed_at,
    confirmation_sent_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test@example.com',
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Test User"}',
    NOW(),
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding user in public.profiles if you have a profiles table
-- (This is commented out since I don't see a profiles table in your schema)
-- INSERT INTO public.profiles (id, email, full_name) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'Test User')
-- ON CONFLICT (id) DO NOTHING;