import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing. Auth features will be disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

const createSafeStub = () => ({
  auth: {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async signInWithPassword() {
      return { data: null, error: new Error('Supabase auth is not configured.') };
    },
    async signUp() {
      return { data: null, error: new Error('Supabase auth is not configured.') };
    },
    async signInWithOAuth() {
      return { data: null, error: new Error('Supabase auth is not configured.') };
    },
    async signOut() {
      return { error: null };
    },
  },
});

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createSafeStub();
