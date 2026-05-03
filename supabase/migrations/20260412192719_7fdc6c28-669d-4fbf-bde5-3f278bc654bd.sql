-- Allow public insert on mask_zones (admin tool, no auth)
CREATE POLICY "Public insert mask_zones"
ON public.mask_zones
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public update on mask_zones
CREATE POLICY "Public update mask_zones"
ON public.mask_zones
FOR UPDATE
TO public
USING (true);

-- Allow public delete on mask_zones
CREATE POLICY "Public delete mask_zones"
ON public.mask_zones
FOR DELETE
TO public
USING (true);

-- Allow public upload to configurator-assets bucket (for mask tool)
CREATE POLICY "Public upload configurator assets"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'configurator-assets');
