import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface LiveTranscriptionState {
    id: number;
    segments: any[];
    current_partial: string;
    is_live: boolean;
    updated_at: string;
}
