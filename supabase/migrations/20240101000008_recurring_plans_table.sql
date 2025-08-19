-- Create recurring_plans table for subscription billing
CREATE TABLE recurring_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    
    -- Billing configuration
    billing_frequency text NOT NULL CHECK (billing_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    billing_amount decimal(12,2) NOT NULL,
    currency text NOT NULL DEFAULT 'PAB',
    
    -- Plan status
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    
    -- Dates
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date, -- NULL means no end date
    next_billing_date date NOT NULL,
    last_invoice_generated_at timestamptz,
    
    -- Invoice template
    invoice_template jsonb NOT NULL DEFAULT '{"items": []}', -- Array of invoice items template
    
    -- Payment settings
    auto_generate_invoices boolean NOT NULL DEFAULT true,
    auto_send_emails boolean NOT NULL DEFAULT false,
    payment_terms_days integer NOT NULL DEFAULT 30,
    
    -- Metadata
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT valid_next_billing CHECK (next_billing_date >= start_date)
);

-- Add indexes
CREATE INDEX idx_recurring_plans_owner ON recurring_plans(owner_user_id);
CREATE INDEX idx_recurring_plans_client ON recurring_plans(client_id);
CREATE INDEX idx_recurring_plans_status ON recurring_plans(status) WHERE status = 'active';
CREATE INDEX idx_recurring_plans_next_billing ON recurring_plans(next_billing_date) WHERE status = 'active';

-- Add RLS
ALTER TABLE recurring_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own recurring plans"
    ON recurring_plans FOR SELECT
    USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create their own recurring plans"
    ON recurring_plans FOR INSERT
    WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own recurring plans"
    ON recurring_plans FOR UPDATE
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own recurring plans"
    ON recurring_plans FOR DELETE
    USING (auth.uid() = owner_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_plans_updated_at
    BEFORE UPDATE ON recurring_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next billing date
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
    current_date date,
    frequency text
)
RETURNS date AS $$
BEGIN
    CASE frequency
        WHEN 'weekly' THEN
            RETURN current_date + INTERVAL '1 week';
        WHEN 'monthly' THEN
            RETURN current_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            RETURN current_date + INTERVAL '3 months';
        WHEN 'yearly' THEN
            RETURN current_date + INTERVAL '1 year';
        ELSE
            RAISE EXCEPTION 'Invalid billing frequency: %', frequency;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to update next billing date after invoice generation
CREATE OR REPLACE FUNCTION update_recurring_plan_after_invoice()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the recurring plan's next billing date and last invoice generated
    UPDATE recurring_plans 
    SET 
        next_billing_date = calculate_next_billing_date(next_billing_date, billing_frequency),
        last_invoice_generated_at = now(),
        updated_at = now()
    WHERE id = NEW.recurring_plan_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add recurring_plan_id to invoices table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'recurring_plan_id'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN recurring_plan_id uuid REFERENCES recurring_plans(id) ON DELETE SET NULL;
        
        CREATE INDEX idx_invoices_recurring_plan ON invoices(recurring_plan_id);
    END IF;
END $$;

-- Trigger to update recurring plan after invoice creation
CREATE OR REPLACE TRIGGER update_recurring_plan_after_invoice_trigger
    AFTER INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.recurring_plan_id IS NOT NULL)
    EXECUTE FUNCTION update_recurring_plan_after_invoice();

