-- Storage setup for xyz-admin

-- Insert buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('expenses_attachments', 'expenses_attachments', false, 10485760, '{"image/*","application/pdf","text/*"}'),
  ('branding', 'branding', true, 2097152, '{"image/*"}')
ON CONFLICT (id) DO NOTHING;

-- RLS policies for expenses_attachments bucket
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expenses_attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'expenses_attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'expenses_attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'expenses_attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policies for branding bucket (public read, owner write)
CREATE POLICY "Anyone can view branding files" ON storage.objects
  FOR SELECT USING (bucket_id = 'branding');

CREATE POLICY "Users can upload own branding files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'branding' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own branding files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'branding' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own branding files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'branding' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );


