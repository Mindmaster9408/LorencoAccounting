// Supabase configuration - uses Zeabur environment variables at runtime

// Zeabur injects env vars as window.<VAR_NAME> for static sites in some cases,
// but to be safe, we'll check multiple common patterns
const supabaseUrl = window.SUPABASE_URL ||
                    (window.ENV && window.ENV.SUPABASE_URL) ||
                    'https://syxyftdhwmdrttifnsga.supabase.co';

const supabaseKey = window.SUPABASE_ANON_KEY ||
                    (window.ENV && window.ENV.SUPABASE_ANON_KEY) ||
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHlmdGRod21kcnR0aWZuc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NjY3OTIsImV4cCI6MjA4NDA0Mjc5Mn0.8Y0jD64ZjAzcIQSc1jmW9iXjR5sVpXFrhigzH4o40jk';

// Initialize Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log('Supabase connected with URL:', supabaseUrl);
