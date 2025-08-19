-- Seed data for development/testing

-- Insert test user profile (will be created automatically by trigger when user signs up)
-- This is just for reference, actual profiles are created via auth trigger

-- Insert sample clients for development
-- Note: These will only work after a user signs up, replace 'user-id-here' with actual user ID

-- Sample client data structure:
/*
INSERT INTO public.clients (owner_user_id, display_name, legal_name, tax_id, emails, payment_terms_days, preferred_currency, billing_notes)
VALUES 
  ('user-id-here', 'Empresa ABC S.A.', 'Empresa ABC Sociedad Anónima', '12345678-9', ARRAY['contacto@empresaabc.com'], 30, 'USD', 'Cliente corporativo con términos extendidos'),
  ('user-id-here', 'Freelancer Juan Pérez', 'Juan Pérez', '8-123-456', ARRAY['juan@email.com'], 15, 'PAB', 'Freelancer de desarrollo web'),
  ('user-id-here', 'Tienda Online XYZ', 'XYZ Commerce Ltd.', '98765432-1', ARRAY['admin@tiendaxyz.com', 'facturacion@tiendaxyz.com'], 15, 'USD', 'E-commerce con pagos rápidos');
*/

-- Sample products/services
/*
INSERT INTO public.products_services (owner_user_id, name, description, unit_price, tax_rate)
VALUES 
  ('user-id-here', 'Consultoría de Software', 'Consultoría especializada en desarrollo de software', 75.00, 7.00),
  ('user-id-here', 'Desarrollo Web', 'Desarrollo de sitios web y aplicaciones', 100.00, 7.00),
  ('user-id-here', 'Mantenimiento Mensual', 'Servicio de mantenimiento y soporte técnico', 200.00, 7.00),
  ('user-id-here', 'Hosting y Dominio', 'Servicio de hosting web y registro de dominio', 25.00, 0.00);
*/

-- Sample expense categories for reference
-- Categories will be entered by users, these are just suggestions

-- Common expense categories in Panama:
-- 'Oficina', 'Transporte', 'Comidas', 'Servicios', 'Equipos', 'Software', 'Marketing', 'Legal', 'Contabilidad', 'Seguros'

-- Sample recurring plan template items structure:
/*
[
  {
    "description": "Mantenimiento mensual del sitio web",
    "qty": 1,
    "unit_price": 200.00,
    "tax_rate": 7.00
  },
  {
    "description": "Hosting y soporte técnico",
    "qty": 1,
    "unit_price": 50.00,
    "tax_rate": 0.00
  }
]
*/

-- Note: To populate with actual data for testing:
-- 1. Sign up a user through the UI
-- 2. Copy the user ID from the profiles table
-- 3. Replace 'user-id-here' with the actual UUID
-- 4. Uncomment and run the INSERT statements


