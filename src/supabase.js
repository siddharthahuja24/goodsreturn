import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xvpjvmmtnbpukgfigvcc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cGp2bW10bmJwdWtnZmlndmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjYzOTUsImV4cCI6MjA5MzY0MjM5NX0.jN0RM0JBlSsagH5dZabLLfCJb-ZkCY7HVKaPFC81dpY'
)
