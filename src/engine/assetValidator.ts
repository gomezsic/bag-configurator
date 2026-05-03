/**
 * Asset Validator
 * 
 * Validation utilities for ensuring asset consistency per the asset spec.
 * Used by the rendering engine at runtime (warnings) and by the future
 * admin panel for upload validation.
 * 
 * Asset Spec v1 Rules:
 * - All files for a view must have identical canvas dimensions
 * - PNG 32-bit RGBA with transparent background
 * - Masks: white (#FFFFFF) on transparent, feather 1-3px
 * - No resize, crop, rotation or displacement between files
 */

import { STANDARD_FABRIC_ZONES, STANDARD_HANDLE_ZONES, STANDARD_OVERLAYS } from './types';
import type { RenderView, RenderMaskZone } from './types';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate that a loaded image matches the expected canvas dimensions.
 */
export function validateImageDimensions(
  img: HTMLImageElement,
  expectedWidth: number,
  expectedHeight: number,
  label: string
): ValidationResult {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };

  if (img.naturalWidth !== expectedWidth || img.naturalHeight !== expectedHeight) {
    result.valid = false;
    result.errors.push(
      `${label}: expected ${expectedWidth}×${expectedHeight}, got ${img.naturalWidth}×${img.naturalHeight}`
    );
  }

  return result;
}

/**
 * Validate all loaded assets against the view's canvas dimensions.
 * Returns warnings for mismatches (doesn't block rendering).
 */
export function validateSceneAssets(
  view: RenderView,
  assets: Map<string, HTMLImageElement>
): ValidationResult {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };
  const { canvasWidth, canvasHeight } = view;

  for (const [url, img] of assets.entries()) {
    // Skip texture images — they have their own dimensions (tiled)
    if (isTextureUrl(url)) continue;

    const check = validateImageDimensions(img, canvasWidth, canvasHeight, url);
    if (!check.valid) {
      result.warnings.push(...check.errors);
    }
  }

  return result;
}

/**
 * Validate zone naming against standard zone types.
 */
export function validateZoneNames(zones: RenderMaskZone[]): ValidationResult {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };

  const allStandard = [
    ...STANDARD_FABRIC_ZONES,
    ...STANDARD_HANDLE_ZONES,
  ] as readonly string[];

  for (const zone of zones) {
    if (!allStandard.includes(zone.zoneType)) {
      result.warnings.push(
        `Non-standard zone type: "${zone.zoneType}". Standard types: ${allStandard.join(', ')}`
      );
    }
  }

  return result;
}

/**
 * Check for duplicate zone types (masks should not overlap).
 */
export function validateNoOverlap(zones: RenderMaskZone[]): ValidationResult {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };
  const seen = new Set<string>();

  for (const zone of zones) {
    if (seen.has(zone.zoneType)) {
      result.valid = false;
      result.errors.push(`Duplicate zone type: "${zone.zoneType}" — masks must not overlap`);
    }
    seen.add(zone.zoneType);
  }

  return result;
}

/**
 * Run all validations on a view.
 */
export function validateView(
  view: RenderView,
  assets?: Map<string, HTMLImageElement>
): ValidationResult {
  const combined: ValidationResult = { valid: true, warnings: [], errors: [] };

  const zoneNames = validateZoneNames(view.maskZones);
  const overlap = validateNoOverlap(view.maskZones);

  combined.warnings.push(...zoneNames.warnings, ...overlap.warnings);
  combined.errors.push(...zoneNames.errors, ...overlap.errors);

  if (assets) {
    const assetCheck = validateSceneAssets(view, assets);
    combined.warnings.push(...assetCheck.warnings);
    combined.errors.push(...assetCheck.errors);
  }

  combined.valid = combined.errors.length === 0;
  return combined;
}

/** Heuristic: texture URLs are not masks/overlays/base images */
function isTextureUrl(url: string): boolean {
  return url.includes('texture_') || url.includes('/textures/') || url.startsWith('data:');
}
