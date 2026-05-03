/**
 * uploadAsset
 *
 * Helper per caricare un file nel bucket pubblico admin-assets di Supabase
 * e ottenere la URL pubblica. Usa un path deterministico con timestamp per
 * evitare cache stale.
 */

import { supabase } from '@/integrations/supabase/client';

export async function uploadAsset(
  file: File,
  folder: string,
  fileNameHint?: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const safeName = (fileNameHint || file.name.replace(/\.[^.]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const path = `${folder}/${safeName}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('admin-assets')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/png',
    });
  if (error) throw error;

  const { data } = supabase.storage.from('admin-assets').getPublicUrl(path);
  return data.publicUrl;
}
