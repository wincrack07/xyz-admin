import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

// Prefer environment variables; fallback to cloud project so the app works out-of-the-box
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://ohpzqbcgajugxwlbtnmp.supabase.co'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocHpxYmNnYWp1Z3h3bGJ0bm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NjY2MjUsImV4cCI6MjA3MTE0MjYyNX0.6xfD4JDV8BsloVs_PCqZ8NbTJimQc7tvkuxngYSj92M'

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

export type { Database }
