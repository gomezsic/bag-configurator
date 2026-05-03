/**
 * ThumbnailUpload
 *
 * Upload di una singola immagine thumbnail con preview, usato in editor di
 * modelli/manici/mappings.
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, ImageOff } from 'lucide-react';
import { uploadAsset } from '@/lib/uploadAsset';
import { toast } from 'sonner';

interface Props {
  label: string;
  url: string | null;
  folder: string;
  onChange: (url: string | null) => void;
}

export const ThumbnailUpload: React.FC<Props> = ({ label, url, folder, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const newUrl = await uploadAsset(file, folder, 'thumb');
      onChange(newUrl);
      toast.success('Thumbnail caricata');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
          {url ? (
            <img src={url} alt={label} className="w-full h-full object-contain" />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Caricamento...' : url ? 'Sostituisci' : 'Carica thumbnail'}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="text-xs">
              Rimuovi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
