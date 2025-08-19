-- Migration to add Yappy payment credentials and fields
-- Add Yappy credentials to clients table

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yappy_merchant_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yappy_secret_key TEXT; -- encrypted
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yappy_domain_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yappy_environment TEXT CHECK (yappy_environment IN ('production', 'test')) DEFAULT 'test';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS yappy_enabled BOOLEAN DEFAULT FALSE;

-- Add Yappy transaction tracking to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS yappy_transaction_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS yappy_order_id TEXT;

-- Add Yappy method support to payments
-- The payments.method field already exists and can handle 'yappy'

-- Create index for Yappy transaction lookups
CREATE INDEX IF NOT EXISTS idx_invoices_yappy_transaction_id ON public.invoices(yappy_transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoices_yappy_order_id ON public.invoices(yappy_order_id);

-- Add audit logging for Yappy operations
-- The audit_logs table already exists and can handle Yappy events

COMMENT ON COLUMN public.clients.yappy_merchant_id IS 'Yappy merchant ID obtained from Yappy Comercial platform';
COMMENT ON COLUMN public.clients.yappy_secret_key IS 'Encrypted Yappy secret key for transaction validation';
COMMENT ON COLUMN public.clients.yappy_domain_url IS 'Domain URL configured in Yappy Comercial for this client';
COMMENT ON COLUMN public.clients.yappy_environment IS 'Yappy environment: test or production';
COMMENT ON COLUMN public.clients.yappy_enabled IS 'Whether Yappy payments are enabled for this client';
COMMENT ON COLUMN public.invoices.yappy_transaction_id IS 'Yappy transaction ID returned from payment creation';
COMMENT ON COLUMN public.invoices.yappy_order_id IS 'Yappy order ID sent in payment request';
