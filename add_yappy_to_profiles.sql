-- Add Yappy fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS yappy_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS yappy_merchant_id TEXT,
ADD COLUMN IF NOT EXISTS yappy_secret_key TEXT,
ADD COLUMN IF NOT EXISTS yappy_domain_url TEXT,
ADD COLUMN IF NOT EXISTS yappy_environment TEXT DEFAULT 'test';

-- Add constraint for environment values (using DO block to handle if constraint already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_yappy_environment_check'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_yappy_environment_check 
        CHECK (yappy_environment IN ('test', 'production'));
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.yappy_enabled IS 'Whether Yappy payments are enabled for this user';
COMMENT ON COLUMN public.profiles.yappy_merchant_id IS 'Yappy merchant ID from Yappy Comercial';
COMMENT ON COLUMN public.profiles.yappy_secret_key IS 'Yappy secret key from Yappy Comercial';
COMMENT ON COLUMN public.profiles.yappy_domain_url IS 'Domain URL configured in Yappy Comercial';
COMMENT ON COLUMN public.profiles.yappy_environment IS 'Yappy environment: test or production';
