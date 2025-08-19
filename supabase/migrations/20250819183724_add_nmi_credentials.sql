-- Add NMI credentials to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS nmi_security_key text,
ADD COLUMN IF NOT EXISTS nmi_merchant_id text,
ADD COLUMN IF NOT EXISTS nmi_username text,
ADD COLUMN IF NOT EXISTS nmi_password text,
ADD COLUMN IF NOT EXISTS nmi_sandbox_mode boolean DEFAULT true;

-- Create a function to decrypt NMI credentials (for Edge Functions)
CREATE OR REPLACE FUNCTION get_nmi_credentials(user_id uuid)
RETURNS TABLE (
  nmi_security_key text,
  nmi_merchant_id text,
  nmi_username text,
  nmi_password text,
  nmi_sandbox_mode boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.nmi_security_key,
    p.nmi_merchant_id,
    p.nmi_username,
    p.nmi_password,
    p.nmi_sandbox_mode
  FROM profiles p
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_nmi_credentials(uuid) TO authenticated;
