-- =====================================================
-- SISTEMA DE CONCILIACIÓN BANCARIA
-- =====================================================

-- Enum para tipos de conciliación
CREATE TYPE conciliation_type AS ENUM (
  'invoice_payment',     -- Factura conciliada con pago bancario
  'expense_payment',     -- Gasto conciliado con transacción bancaria
  'manual_income',       -- Ingreso manual conciliado con transacción bancaria
  'subscription_payment' -- Pago de suscripción conciliado
);

-- Enum para estados de conciliación
CREATE TYPE conciliation_status AS ENUM (
  'pending',    -- Pendiente de conciliación
  'partial',    -- Conciliación parcial
  'complete',   -- Completamente conciliado
  'cancelled'   -- Conciliación cancelada
);

-- Tabla de conciliaciones
CREATE TABLE conciliations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo y estado
  conciliation_type conciliation_type NOT NULL,
  status conciliation_status NOT NULL DEFAULT 'pending',
  
  -- Referencias a registros relacionados
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  recurring_plan_id UUID REFERENCES recurring_plans(id) ON DELETE CASCADE,
  
  -- Montos
  expected_amount NUMERIC(12,2) NOT NULL,
  conciliated_amount NUMERIC(12,2) DEFAULT 0,
  difference_amount NUMERIC(12,2) GENERATED ALWAYS AS (expected_amount - conciliated_amount) STORED,
  
  -- Fechas
  expected_date DATE,
  conciliated_date DATE,
  
  -- Metadatos
  notes TEXT,
  auto_conciliated BOOLEAN DEFAULT FALSE, -- Si fue conciliado automáticamente
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para conciliations
CREATE INDEX idx_conciliations_owner_id ON conciliations(owner_id);
CREATE INDEX idx_conciliations_type ON conciliations(conciliation_type);
CREATE INDEX idx_conciliations_status ON conciliations(status);
CREATE INDEX idx_conciliations_invoice_id ON conciliations(invoice_id);
CREATE INDEX idx_conciliations_transaction_id ON conciliations(transaction_id);
CREATE INDEX idx_conciliations_expected_date ON conciliations(expected_date);

-- Actualizar tabla de facturas para incluir estado de conciliación
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS conciliation_status conciliation_status DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS conciliated_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_conciliated_at TIMESTAMPTZ;

-- Actualizar tabla de gastos para incluir estado de conciliación
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS conciliation_status conciliation_status DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS conciliated_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS last_conciliated_at TIMESTAMPTZ;

-- Crear tabla de ingresos manuales (separada de transacciones bancarias)
CREATE TABLE manual_income (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información básica
  income_date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  source TEXT, -- Cliente, proyecto, etc.
  
  -- Montos
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PAB',
  
  -- Conciliación
  conciliation_status conciliation_status DEFAULT 'pending',
  conciliated_amount NUMERIC(12,2) DEFAULT 0,
  last_conciliated_at TIMESTAMPTZ,
  
  -- Metadatos
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para manual_income
CREATE INDEX idx_manual_income_owner_id ON manual_income(owner_id);
CREATE INDEX idx_manual_income_date ON manual_income(income_date);
CREATE INDEX idx_manual_income_status ON manual_income(conciliation_status);

-- Actualizar tabla de planes recurrentes para generar facturas automáticas
ALTER TABLE recurring_plans ADD COLUMN IF NOT EXISTS auto_generate_invoices BOOLEAN DEFAULT TRUE;
ALTER TABLE recurring_plans ADD COLUMN IF NOT EXISTS last_invoice_generated_at TIMESTAMPTZ;
ALTER TABLE recurring_plans ADD COLUMN IF NOT EXISTS next_invoice_date DATE;

-- RLS Policies para conciliations
ALTER TABLE conciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conciliations" ON conciliations
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own conciliations" ON conciliations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own conciliations" ON conciliations
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own conciliations" ON conciliations
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies para manual_income
ALTER TABLE manual_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual income" ON manual_income
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own manual income" ON manual_income
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own manual income" ON manual_income
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own manual income" ON manual_income
  FOR DELETE USING (auth.uid() = owner_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_conciliations_updated_at 
  BEFORE UPDATE ON conciliations 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_manual_income_updated_at 
  BEFORE UPDATE ON manual_income 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Función para auto-conciliar transacciones
CREATE OR REPLACE FUNCTION auto_conciliate_transactions()
RETURNS TRIGGER AS $$
DECLARE
  matching_invoice invoices%ROWTYPE;
  matching_expense expenses%ROWTYPE;
  matching_income manual_income%ROWTYPE;
BEGIN
  -- Solo procesar transacciones que no sean transferencias internas
  IF NEW.merchant_name = 'Transferencia Entre Cuentas' THEN
    RETURN NEW;
  END IF;

  -- Intentar conciliar con facturas pendientes (ingresos)
  IF NEW.amount > 0 THEN
    SELECT * INTO matching_invoice 
    FROM invoices 
    WHERE owner_user_id = NEW.owner_id 
      AND status = 'sent'
      AND conciliation_status IN ('pending', 'partial')
      AND ABS(total - NEW.amount) <= 5.00 -- Tolerancia de $5
      AND ABS(EXTRACT(days FROM (due_date - NEW.posted_at::date))) <= 30 -- Dentro de 30 días
    ORDER BY ABS(total - NEW.amount), ABS(EXTRACT(days FROM (due_date - NEW.posted_at::date)))
    LIMIT 1;

    IF matching_invoice.id IS NOT NULL THEN
      -- Crear conciliación automática
      INSERT INTO conciliations (
        owner_id, conciliation_type, status, invoice_id, transaction_id,
        expected_amount, conciliated_amount, expected_date, conciliated_date,
        auto_conciliated, notes
      ) VALUES (
        NEW.owner_id, 'invoice_payment', 'complete', matching_invoice.id, NEW.id,
        matching_invoice.total, NEW.amount, matching_invoice.due_date, NEW.posted_at::date,
        TRUE, 'Auto-conciliado por sistema'
      );

      -- Actualizar estado de factura
      UPDATE invoices SET 
        status = 'paid',
        conciliation_status = 'complete',
        conciliated_amount = NEW.amount,
        last_conciliated_at = NOW()
      WHERE id = matching_invoice.id;
    END IF;

  -- Intentar conciliar con gastos pendientes (egresos)
  ELSIF NEW.amount < 0 THEN
    SELECT * INTO matching_expense
    FROM expenses 
    WHERE owner_user_id = NEW.owner_id 
      AND conciliation_status IN ('pending', 'partial')
      AND ABS(amount - ABS(NEW.amount)) <= 5.00 -- Tolerancia de $5
      AND ABS(EXTRACT(days FROM (spend_date - NEW.posted_at::date))) <= 7 -- Dentro de 7 días
    ORDER BY ABS(amount - ABS(NEW.amount)), ABS(EXTRACT(days FROM (spend_date - NEW.posted_at::date)))
    LIMIT 1;

    IF matching_expense.id IS NOT NULL THEN
      -- Crear conciliación automática
      INSERT INTO conciliations (
        owner_id, conciliation_type, status, expense_id, transaction_id,
        expected_amount, conciliated_amount, expected_date, conciliated_date,
        auto_conciliated, notes
      ) VALUES (
        NEW.owner_id, 'expense_payment', 'complete', matching_expense.id, NEW.id,
        matching_expense.amount, ABS(NEW.amount), matching_expense.spend_date, NEW.posted_at::date,
        TRUE, 'Auto-conciliado por sistema'
      );

      -- Actualizar estado de gasto
      UPDATE expenses SET 
        conciliation_status = 'complete',
        conciliated_amount = ABS(NEW.amount),
        last_conciliated_at = NOW()
      WHERE id = matching_expense.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-conciliación en transacciones nuevas
CREATE TRIGGER trigger_auto_conciliate_transactions
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_conciliate_transactions();

-- Vista para dashboard de conciliación
CREATE OR REPLACE VIEW conciliation_dashboard AS
SELECT 
  owner_id,
  
  -- Facturas
  COUNT(CASE WHEN conciliation_type = 'invoice_payment' AND status = 'pending' THEN 1 END) as pending_invoices,
  COUNT(CASE WHEN conciliation_type = 'invoice_payment' AND status = 'complete' THEN 1 END) as conciliated_invoices,
  SUM(CASE WHEN conciliation_type = 'invoice_payment' AND status = 'pending' THEN expected_amount ELSE 0 END) as pending_invoice_amount,
  
  -- Gastos
  COUNT(CASE WHEN conciliation_type = 'expense_payment' AND status = 'pending' THEN 1 END) as pending_expenses,
  COUNT(CASE WHEN conciliation_type = 'expense_payment' AND status = 'complete' THEN 1 END) as conciliated_expenses,
  SUM(CASE WHEN conciliation_type = 'expense_payment' AND status = 'pending' THEN expected_amount ELSE 0 END) as pending_expense_amount,
  
  -- Ingresos manuales
  COUNT(CASE WHEN conciliation_type = 'manual_income' AND status = 'pending' THEN 1 END) as pending_manual_income,
  COUNT(CASE WHEN conciliation_type = 'manual_income' AND status = 'complete' THEN 1 END) as conciliated_manual_income,
  SUM(CASE WHEN conciliation_type = 'manual_income' AND status = 'pending' THEN expected_amount ELSE 0 END) as pending_manual_income_amount

FROM conciliations
GROUP BY owner_id;

-- Comentarios para documentación
COMMENT ON TABLE conciliations IS 'Tabla principal para gestionar conciliaciones entre facturas, gastos, ingresos y transacciones bancarias';
COMMENT ON TABLE manual_income IS 'Ingresos manuales que pueden ser conciliados con transacciones bancarias';
COMMENT ON COLUMN conciliations.auto_conciliated IS 'Indica si la conciliación fue realizada automáticamente por el sistema';
COMMENT ON FUNCTION auto_conciliate_transactions() IS 'Función que intenta conciliar automáticamente las transacciones bancarias con facturas y gastos existentes';


