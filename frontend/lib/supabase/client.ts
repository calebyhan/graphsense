import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder_publishable_key';

// Check if we're in a valid environment with proper Supabase configuration
export const isSupabaseConfigured = () => {
  return (
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabasePublishableKey !== 'placeholder_publishable_key' &&
    supabaseUrl.includes('supabase.co')
  );
};

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});