/**
 * Supabase client for frontend
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    })
    : null;

if (!supabase) {
    console.warn('⚠️  Supabase not configured. Social login will not work.');
}

/**
 * Sign in with Google using Supabase OAuth
 */
export async function signInWithGoogle() {
    if (!supabase) {
        throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Sign in with Facebook using Supabase OAuth
 */
export async function signInWithFacebook() {
    if (!supabase) {
        throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });

    if (error) {
        throw error;
    }

    return data;
}

