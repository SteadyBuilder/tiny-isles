/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://glupmjigierisxtzjfgn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdXBtamlnaWVyaXN4dHpqZmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MzY5MTksImV4cCI6MjEwOTUxMjkxOX0.6hHoimaZI54SGtBuY1grVUWXzC62B4zyEo2IDtl7b3o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
