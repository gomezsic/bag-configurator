/**
 * Asset Loader
 * 
 * Handles loading and caching of image assets (textures, masks, overlays).
 * All images are loaded as HTMLImageElement instances ready for canvas drawing.
 */

const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

/** Load a single image, with cache */
export function loadImage(url: string): Promise<HTMLImageElement> {
  // Return cached
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);

  // Return in-flight promise
  const existing = loadingPromises.get(url);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      loadingPromises.delete(url);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(url);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });

  loadingPromises.set(url, promise);
  return promise;
}

/** Load multiple images in parallel, returns a map of url → image */
export async function loadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
  const validUrls = urls.filter(Boolean);
  const results = await Promise.allSettled(validUrls.map(url => loadImage(url)));
  
  const map = new Map<string, HTMLImageElement>();
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      map.set(validUrls[i], result.value);
    } else {
      console.warn(`[AssetLoader] Failed to load: ${validUrls[i]}`);
    }
  });
  
  return map;
}

/** Preload all assets needed for a render scene */
export async function preloadSceneAssets(
  baseImageUrl: string | null,
  overlayUrl: string | null,
  maskUrls: string[],
  localOverlayUrls: string[],
  fabricTextureUrl: string | null,
  handleTextureUrl: string | null,
  embroideryImageUrl: string | null,
  overlayUrls: string[] = []
): Promise<Map<string, HTMLImageElement>> {
  const allUrls: string[] = [];
  
  if (baseImageUrl) allUrls.push(baseImageUrl);
  if (overlayUrl) allUrls.push(overlayUrl);
  if (fabricTextureUrl) allUrls.push(fabricTextureUrl);
  if (handleTextureUrl) allUrls.push(handleTextureUrl);
  if (embroideryImageUrl) allUrls.push(embroideryImageUrl);
  allUrls.push(...maskUrls.filter(Boolean));
  allUrls.push(...localOverlayUrls.filter(Boolean));
  allUrls.push(...overlayUrls.filter(Boolean));

  return loadImages(allUrls);
}

/** Clear the entire cache */
export function clearAssetCache(): void {
  imageCache.clear();
  loadingPromises.clear();
}

/** Get cache stats for debugging */
export function getCacheStats() {
  return {
    cached: imageCache.size,
    loading: loadingPromises.size,
  };
}
