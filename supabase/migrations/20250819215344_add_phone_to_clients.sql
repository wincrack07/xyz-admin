-- Add phone field to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.phone IS 'Client phone number for Yappy payments and other communications';
