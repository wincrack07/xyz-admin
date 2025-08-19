-- RPC functions for invoice detail view

-- Function to get invoice payments
CREATE OR REPLACE FUNCTION get_invoice_payments(p_invoice_id uuid)
RETURNS TABLE (
  id uuid,
  paid_at timestamptz,
  amount numeric,
  currency text,
  method text,
  status text,
  nmi_txn_id text,
  raw_payload jsonb,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.paid_at,
    p.amount,
    p.currency,
    p.method,
    p.status::text,
    p.nmi_txn_id,
    p.raw_payload,
    p.created_at
  FROM payments p
  WHERE p.invoice_id = p_invoice_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Function to get invoice audit logs
CREATE OR REPLACE FUNCTION get_invoice_logs(p_invoice_id uuid)
RETURNS TABLE (
  id bigint,
  event text,
  actor text,
  entity text,
  payload jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.event,
    al.actor,
    al.entity,
    al.payload,
    al.created_at
  FROM audit_logs al
  WHERE al.entity = 'invoice:' || p_invoice_id::text
  ORDER BY al.created_at DESC;
END;
$$;

-- Function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status(
  p_invoice_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_status text;
  current_payment_count int;
  current_total_paid numeric;
BEGIN
  -- Get current invoice status and payment info
  SELECT status, payment_count, total_paid 
  INTO current_status, current_payment_count, current_total_paid
  FROM invoices 
  WHERE id = p_invoice_id;
  
  -- Validate status transition
  IF current_status = 'pagada' AND p_new_status = 'cotización' THEN
    IF current_payment_count > 0 THEN
      RAISE EXCEPTION 'No se puede revertir a cotización una factura que tiene pagos';
    END IF;
  END IF;
  
  -- Update invoice status
  UPDATE invoices 
  SET status = p_new_status::invoice_status
  WHERE id = p_invoice_id;
  
  -- Log the status change
  INSERT INTO audit_logs (owner_user_id, event, actor, entity, payload)
  VALUES (
    (SELECT owner_user_id FROM invoices WHERE id = p_invoice_id),
    'invoice_status_changed',
    'user:' || auth.uid()::text,
    'invoice:' || p_invoice_id::text,
    jsonb_build_object(
      'old_status', current_status,
      'new_status', p_new_status,
      'notes', p_notes
    )
  );
  
  RETURN true;
END;
$$;
