-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bank accounts table
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL CHECK (bank_name IN ('banco_general', 'banesco', 'bac_credomatic', 'global_bank', 'other')),
    account_alias TEXT NOT NULL,
    account_number_mask TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PAB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique account per owner
    UNIQUE(owner_id, account_number_mask)
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique category name per owner
    UNIQUE(owner_id, name)
);

-- Category rules table
CREATE TABLE category_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    posted_at DATE NOT NULL,
    description TEXT NOT NULL,
    merchant_name TEXT,
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2),
    currency TEXT NOT NULL DEFAULT 'PAB',
    external_fingerprint TEXT NOT NULL UNIQUE,
    raw JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction categories junction table
CREATE TABLE transaction_categories (
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (transaction_id, category_id)
);

-- Create indexes for performance
CREATE INDEX idx_bank_accounts_owner_id ON bank_accounts(owner_id);
CREATE INDEX idx_categories_owner_id ON categories(owner_id);
CREATE INDEX idx_category_rules_owner_id ON category_rules(owner_id);
CREATE INDEX idx_category_rules_active ON category_rules(active) WHERE active = true;
CREATE INDEX idx_transactions_owner_id ON transactions(owner_id);
CREATE INDEX idx_transactions_bank_account_id ON transactions(bank_account_id);
CREATE INDEX idx_transactions_posted_at ON transactions(posted_at);
CREATE INDEX idx_transactions_external_fingerprint ON transactions(external_fingerprint);
CREATE INDEX idx_transaction_categories_transaction_id ON transaction_categories(transaction_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_rules_updated_at BEFORE UPDATE ON category_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY "Users can view their own bank accounts" ON bank_accounts
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own bank accounts" ON bank_accounts
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own bank accounts" ON bank_accounts
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own bank accounts" ON bank_accounts
    FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for categories
CREATE POLICY "Users can view their own categories" ON categories
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own categories" ON categories
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own categories" ON categories
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own categories" ON categories
    FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for category_rules
CREATE POLICY "Users can view their own category rules" ON category_rules
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own category rules" ON category_rules
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own category rules" ON category_rules
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own category rules" ON category_rules
    FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions" ON transactions
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own transactions" ON transactions
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own transactions" ON transactions
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own transactions" ON transactions
    FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for transaction_categories (through transaction ownership)
CREATE POLICY "Users can view transaction categories for their transactions" ON transaction_categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM transactions 
            WHERE transactions.id = transaction_categories.transaction_id 
            AND transactions.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transaction categories for their transactions" ON transaction_categories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM transactions 
            WHERE transactions.id = transaction_categories.transaction_id 
            AND transactions.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete transaction categories for their transactions" ON transaction_categories
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM transactions 
            WHERE transactions.id = transaction_categories.transaction_id 
            AND transactions.owner_id = auth.uid()
        )
    );

-- Insert default categories for new users
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categories (owner_id, name, color) VALUES
        (NEW.id, 'Alimentación', '#F59E0B'),
        (NEW.id, 'Transporte', '#3B82F6'),
        (NEW.id, 'Servicios', '#10B981'),
        (NEW.id, 'Equipos', '#8B5CF6'),
        (NEW.id, 'Marketing', '#EC4899'),
        (NEW.id, 'Software', '#6366F1'),
        (NEW.id, 'Consultoría', '#F59E0B'),
        (NEW.id, 'Viajes', '#EF4444'),
        (NEW.id, 'Otros', '#6B7280');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default categories when a user signs up
CREATE TRIGGER create_default_categories_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_categories();


