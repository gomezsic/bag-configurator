/**
 * Overlay Extractor
 *
 * Generates the three runtime overlays (shadows, highlights, details) from
 * a single neutral product photo (the "base image"). The output PNGs are
 * intended to be composed by the rendering engine on top of the colored
 * fabric layers to restore depth and metallic detail that gets lost when
 * masks are filled with a flat texture.
 *
 * Approach (per pixel, in HSL/luma space):
 *   - shadows  : isolate dark midtones, tinted neutral grey, blend = multiply
 *   - highlights: isolate bright midtones, tinted near-white, blend = screen
 *   - details  : isolate "non-grey" / saturated regions (zips, hardware,
 *                metal rings, leather trims) keeping their ORIGINAL colour,
 *                blend = normal
 *
 * The thresholds are empirically tuned for studio neutral photos but are
 * fully configurable via the `ExtractParams` argument so the operator can
 * fine-tune them in the admin UI.
 */
export interface ExtractParams {
  /** Pixels darker than this luminance (0-255) become shadows. */
  shadowThreshold: number;
  /** Pixels brighter than this luminance (0-255) become highlights. */
  highlightThreshold: number;
  /** Saturation (0-255) above which a pixel is considered "metallic / detail". */
  detailSaturationThreshold: number;
  /**
   * Pixels DARKER than this luminance are also captured as "details" even if
   * they have very low saturation. This catches black zips, dark metallic
   * hardware (gunmetal carabiners, brushed steel rings) that would otherwise
   * be lost because they are achromatic. Set to 0 to disable.
   */
  detailDarkThreshold: number;
  /** Strength multiplier 0..1 for shadow alpha. */
  shadowStrength: number;
  /** Strength multiplier 0..1 for highlight alpha. */
  highlightStrength: number;
  /** Strength multiplier 0..1 for details alpha. */
  detailStrength: number;
  /** Soft feather (px) applied to all three masks. */
  featherPx: number;
}

export const DEFAULT_EXTRACT_PARAMS: ExtractParams = {
  shadowThreshold: 95,
  highlightThreshold: 205,
  detailSaturationThreshold: 22,
  detailDarkThreshold: 55,
  shadowStrength: 0.6,
  highlightStrength: 0.55,
  detailStrength: 1,
  featherPx: 1,
};

/** Quick presets that the operator can apply with one click. */
export const EXTRACT_PRESETS: Record<string, { label: string; params: ExtractParams }> = {
  neutralLight: {
    label: 'Foto neutra chiara',
    params: {
      shadowThreshold: 95,
      highlightThreshold: 205,
      detailSaturationThreshold: 22,
      detailDarkThreshold: 55,
      shadowStrength: 0.6,
      highlightStrength: 0.55,
      detailStrength: 1,
      featherPx: 1,
    },
  },
  contrasted: {
    label: 'Foto contrastata',
    params: {
      shadowThreshold: 75,
      highlightThreshold: 220,
      detailSaturationThreshold: 30,
      detailDarkThreshold: 40,
      shadowStrength: 0.5,
      highlightStrength: 0.5,
      detailStrength: 1,
      featherPx: 1.5,
    },
  },
  metalsOnly: {
    label: 'Solo metalli e zip',
    params: {
      shadowThreshold: 60,
      highlightThreshold: 230,
      detailSaturationThreshold: 15,
      detailDarkThreshold: 70,
      shadowStrength: 0.35,
      highlightStrength: 0.35,
      detailStrength: 1,
      featherPx: 0.5,
    },
  },
};

export interface ExtractedOverlays {
  shadowsBlob: Blob;
  highlightsBlob: Blob;
  detailsBlob: Blob;
  /** Data URLs for instant in-browser preview. */
  shadowsDataUrl: string;
  highlightsDataUrl: string;
  detailsDataUrl: string;
}

/**
 * Run the extraction pipeline on the given base image URL and return three
 * PNG blobs ready to upload + matching data URLs for preview.
 */
export async function extractOverlaysFromBase(
  baseImageUrl: string,
  params: ExtractParams = DEFAULT_EXTRACT_PARAMS
): Promise<ExtractedOverlays> {
  const img = await loadImage(baseImageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Source pixels
  const src = drawToCanvas(img, w, h);
  const srcCtx = src.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const sp = srcData.data;

  // Output buffers (premultiplied straightforward write)
  const shadowsImg = new ImageData(w, h);
  const highlightsImg = new ImageData(w, h);
  const detailsImg = new ImageData(w, h);
  const shP = shadowsImg.data;
  const hiP = highlightsImg.data;
  const deP = detailsImg.data;

  for (let i = 0; i < sp.length; i += 4) {
    const r = sp[i];
    const g = sp[i + 1];
    const b = sp[i + 2];
    const a = sp[i + 3];
    if (a < 8) continue; // transparent → leave all overlays transparent

    // Rec.709 luma (perceptual)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // HSV-style saturation: max-min over max
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : ((max - min) / max) * 255;

    /* ---- DETAILS (saturated colour OR very dark non-fabric: leather, metal hardware, black zips) ----
     * Keep original RGB. Alpha is the MAX of two contributions:
     *   a) saturation above threshold → coloured details
     *   b) luminance below detailDarkThreshold → dark hardware (black zips, gunmetal)
     * This is what restores zip/clip/ring colour on top of the fabric. */
    let detailAlpha = 0;
    if (sat > params.detailSaturationThreshold) {
      const t = Math.min(1, (sat - params.detailSaturationThreshold) / (255 - params.detailSaturationThreshold));
      detailAlpha = Math.max(detailAlpha, t);
    }
    if (params.detailDarkThreshold > 0 && luma < params.detailDarkThreshold) {
      const t = (params.detailDarkThreshold - luma) / params.detailDarkThreshold;
      detailAlpha = Math.max(detailAlpha, t);
    }
    if (detailAlpha > 0) {
      deP[i] = r;
      deP[i + 1] = g;
      deP[i + 2] = b;
      deP[i + 3] = Math.round(255 * detailAlpha * params.detailStrength);
    }

    /* ---- SHADOWS ---- */
    if (luma < params.shadowThreshold) {
      const t = (params.shadowThreshold - luma) / params.shadowThreshold; // 0..1
      const alpha = Math.round(255 * t * params.shadowStrength);
      // Neutral mid-grey so multiply darkens evenly without colour cast
      shP[i] = 64;
      shP[i + 1] = 64;
      shP[i + 2] = 64;
      shP[i + 3] = alpha;
    }

    /* ---- HIGHLIGHTS ---- */
    if (luma > params.highlightThreshold) {
      const t = (luma - params.highlightThreshold) / (255 - params.highlightThreshold); // 0..1
      const alpha = Math.round(255 * t * params.highlightStrength);
      hiP[i] = 245;
      hiP[i + 1] = 245;
      hiP[i + 2] = 245;
      hiP[i + 3] = alpha;
    }
  }

  // Write each into its own canvas, optionally feather, then export
  const [shadowsBlob, shadowsDataUrl] = await finalize(shadowsImg, w, h, params.featherPx);
  const [highlightsBlob, highlightsDataUrl] = await finalize(highlightsImg, w, h, params.featherPx);
  const [detailsBlob, detailsDataUrl] = await finalize(detailsImg, w, h, params.featherPx);

  return {
    shadowsBlob,
    highlightsBlob,
    detailsBlob,
    shadowsDataUrl,
    highlightsDataUrl,
    detailsDataUrl,
  };
}

/* ===== helpers ===== */

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossibile caricare la base image'));
    img.src = url;
  });
}

function drawToCanvas(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

async function finalize(
  data: ImageData,
  w: number,
  h: number,
  featherPx: number
): Promise<[Blob, string]> {
  // Step A: write the raw extracted data
  const raw = document.createElement('canvas');
  raw.width = w;
  raw.height = h;
  raw.getContext('2d')!.putImageData(data, 0, 0);

  // Step B: feather alpha by blurring onto a second canvas
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  if (featherPx > 0) octx.filter = `blur(${featherPx}px)`;
  octx.drawImage(raw, 0, 0);
  octx.filter = 'none';

  const blob: Blob = await new Promise(resolve =>
    out.toBlob(b => resolve(b!), 'image/png')
  );
  const dataUrl = out.toDataURL('image/png');
  return [blob, dataUrl];
}

/** Convert a Blob to a File so it can be passed to uploadAsset(). */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || 'image/png' });
}
