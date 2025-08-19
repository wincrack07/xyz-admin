// Environment configuration
export const env = {
  // Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://ohpzqbcgajugxwlbtnmp.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocHpxYmNnYWp1Z3h3bGJ0bm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxNzg1MjIsImV4cCI6MjA0OTc1NDUyMn0.3PqVf4Hqt7r3xUHEQEXAWvJb2Hd-u0sGQTZSZQWJZEo'
  },
  
  // App settings
  app: {
    name: 'XYZ Admin',
    version: '1.0.0',
    timezone: 'America/Panama',
    currency: 'PAB',
    locale: 'es-PA'
  },
  
  // Feature flags
  features: {
    nmiPayments: true,
    emailNotifications: true,
    bankImport: true,
    recurringPlans: true,
    pdfGeneration: true
  }
}

