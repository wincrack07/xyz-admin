-- Function to get next invoice number for a series
CREATE OR REPLACE FUNCTION get_next_invoice_number(
    p_owner_user_id uuid,
    p_series text DEFAULT 'A'
)
RETURNS integer AS $$
DECLARE
    next_number integer;
BEGIN
    -- Get the next number for this user and series
    SELECT COALESCE(MAX(number), 0) + 1
    INTO next_number
    FROM invoices
    WHERE owner_user_id = p_owner_user_id 
    AND series = p_series;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_next_invoice_number(uuid, text) TO authenticated;


