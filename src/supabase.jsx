import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://wpzgdyrtumcbqewezlss.supabase.co'
const supabaseKey = 'sb_publishable_C28oAwxC5xHp6tv0mYBDjw_9gEkoYaK'
export const supabase = createClient(supabaseUrl, supabaseKey)