/**
 * HandleAssetUploader
 *
 * Pannello compatto per caricare i 5 PNG del manico in handle_geometries:
 * mask (obbligatorio), shadow, highlight, details, hardware (tutti opzionali).
 * Upload diretto su admin-assets, salva URL nella riga della geometria.
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadAsset } from '@/lib/uploadAsset';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Download } from 'lucide-react';

type AssetField =
  | 'mask_url'
  | 'shadow_url'
  | 'highlight_url'
  | 'details_url'
  | 'hardware_url';

interface AssetSlotProps {
  label: string;
  field: AssetField;
  value: string | null;
  required?: boolean;
  geometryId: string;
  onSaved: () => void;
}

const AssetSlot: React.FC<AssetSlotProps> = ({
  label,
  field,
  value,
  required,
  geometryId,
  onSaved,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    try {
      setBusy(true);
      const url = await uploadAsset(file, `handles/${geometryId}`, field);
      const patch: Record<string, string> = { [field]: url };
      const { error } = await supabase
        .from('handle_geometries')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq('id', geometryId);
      if (error) throw error;
      toast.success(`${label} caricato`);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(`Errore upload ${label}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (!value) return;
    try {
      setBusy(true);
      const patch: Record<string, null> = { [field]: null };
      const { error } = await supabase
        .from('handle_geometries')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq('id', geometryId);
      if (error) throw error;
      toast.success(`${label} rimosso`);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error('Errore');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!value) return;
    try {
      setBusy(true);
      // Forza il fetch (bypassa cache) per scaricare la versione corrente del PNG
      const bust = value.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
      const resp = await fetch(value + bust, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      // Nome file leggibile: campo + ultimi 8 char dell'id geometria + estensione
      const ext = (blob.type.split('/')[1] || 'png').split('+')[0];
      const shortId = geometryId.slice(0, 8);
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = `${field}_${shortId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      toast.success(`${label} scaricato`);
    } catch (e) {
      console.error(e);
      toast.error(`Errore download ${label}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-md p-2 bg-card flex items-center gap-3">
      <div className="w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center shrink-0">
        {value ? (
          <img src={value} alt={label} className="w-full h-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">vuoto</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex gap-1 mt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            {value ? 'Sostituisci' : 'Carica'}
          </Button>
          {value && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                disabled={busy}
                onClick={handleDownload}
                title="Scarica per modificare in Photoshop / GIMP"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                disabled={busy}
                onClick={handleClear}
                title="Rimuovi"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    </div>
  );
};

interface Props {
  geometryId: string;
  values: {
    mask_url: string | null;
    shadow_url: string | null;
    highlight_url: string | null;
    details_url: string | null;
    hardware_url: string | null;
  };
  onSaved: () => void;
}

const HandleAssetUploader: React.FC<Props> = ({ geometryId, values, onSaved }) => {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
        Asset manico
      </h3>
      <div className="grid grid-cols-1 gap-2">
        <AssetSlot
          label="Mask"
          field="mask_url"
          value={values.mask_url}
          required
          geometryId={geometryId}
          onSaved={onSaved}
        />
        <AssetSlot
          label="Shadow"
          field="shadow_url"
          value={values.shadow_url}
          geometryId={geometryId}
          onSaved={onSaved}
        />
        <AssetSlot
          label="Highlight"
          field="highlight_url"
          value={values.highlight_url}
          geometryId={geometryId}
          onSaved={onSaved}
        />
        <AssetSlot
          label="Details"
          field="details_url"
          value={values.details_url}
          geometryId={geometryId}
          onSaved={onSaved}
        />
        <AssetSlot
          label="Hardware"
          field="hardware_url"
          value={values.hardware_url}
          geometryId={geometryId}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
};

export default HandleAssetUploader;
