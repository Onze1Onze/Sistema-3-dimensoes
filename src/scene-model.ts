import type { Image as OBRImage, Item } from "@owlbear-rodeo/sdk";

export const WORLD_UNITS_PER_PIXEL = 0.01;

export interface SceneFrame {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SceneCounts {
  maps: number;
  tokens: number;
  props: number;
}

export interface SceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

/** Build the frame from Owlbear's already-transformed, authoritative bounds. */
export function calculateSceneFrameFromBounds(bounds: SceneBounds | null | undefined): SceneFrame | null {
  if (!bounds) return null;
  const values = [bounds.min?.x, bounds.min?.y, bounds.max?.x, bounds.max?.y];
  if (!values.every((value) => Number.isFinite(value))) return null;

  const minX = Math.min(bounds.min.x, bounds.max.x);
  const minY = Math.min(bounds.min.y, bounds.max.y);
  const maxX = Math.max(bounds.min.x, bounds.max.x);
  const maxY = Math.max(bounds.min.y, bounds.max.y);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    width,
    height,
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function isOwlbearImage(item: Item): item is OBRImage {
  return item.type === "IMAGE" && "image" in item;
}

export function getSceneImages(items: Item[]): OBRImage[] {
  return items.filter(isOwlbearImage).filter((item) => item.visible !== false);
}

export function getSceneCounts(items: Item[]): SceneCounts {
  const images = getSceneImages(items);
  return {
    maps: images.filter((item) => item.layer === "MAP" && item.image.mime.startsWith("image/")).length,
    tokens: images.filter((item) => (item.layer === "CHARACTER" || item.layer === "MOUNT") && item.image.mime.startsWith("image/")).length,
    props: images.filter((item) => item.layer === "PROP" && item.image.mime.startsWith("image/")).length,
  };
}

function imageHalfExtents(item: OBRImage, sceneDpi: number): { x: number; y: number } {
  const size = getImageWorldSize(item, sceneDpi);
  const width = size.width / WORLD_UNITS_PER_PIXEL;
  const height = size.height / WORLD_UNITS_PER_PIXEL;
  const angle = (item.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    x: (width * cos + height * sin) / 2,
    y: (width * sin + height * cos) / 2,
  };
}

export function calculateSceneFrame(items: Item[], sceneDpi = 100): SceneFrame | null {
  const maps = getSceneImages(items).filter(
    (item) => item.layer === "MAP" && item.image.mime.startsWith("image/") && item.image.width > 0 && item.image.height > 0,
  );
  if (maps.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const map of maps) {
    const half = imageHalfExtents(map, sceneDpi);
    minX = Math.min(minX, map.position.x - half.x);
    minY = Math.min(minY, map.position.y - half.y);
    maxX = Math.max(maxX, map.position.x + half.x);
    maxY = Math.max(maxY, map.position.y + half.y);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    width,
    height,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/**
 * Owlbear screen coordinates grow downward. The map plane is rotated -90°
 * around X, so its top edge occupies negative Z and its bottom edge positive Z.
 */
export function mapToWorld(x: number, y: number, frame: SceneFrame): { x: number; z: number } {
  return {
    x: (x - frame.centerX) * WORLD_UNITS_PER_PIXEL,
    z: (y - frame.centerY) * WORLD_UNITS_PER_PIXEL,
  };
}

/** Exact inverse of mapToWorld, including Owlbear's downward-positive Y axis. */
export function worldToMap(x: number, z: number, frame: SceneFrame): { x: number; y: number } {
  return {
    x: x / WORLD_UNITS_PER_PIXEL + frame.centerX,
    y: frame.centerY + z / WORLD_UNITS_PER_PIXEL,
  };
}

/**
 * Converts source-image pixels to Owlbear scene pixels before applying the
 * 3D scale. An image's grid DPI describes the pixel density of that asset;
 * the scene DPI describes the pixel density of the active tabletop grid.
 */
export function getImageWorldSize(item: OBRImage, sceneDpi = 100): { width: number; height: number } {
  const targetDpi = Number.isFinite(sceneDpi) && sceneDpi > 0 ? sceneDpi : 100;
  const sourceDpi = Number(item.grid?.dpi);
  const dpiRatio = Number.isFinite(sourceDpi) && sourceDpi > 0 ? targetDpi / sourceDpi : 1;
  return {
    width: Math.max(0.01, Math.abs(item.image.width * item.scale.x * dpiRatio) * WORLD_UNITS_PER_PIXEL),
    height: Math.max(0.01, Math.abs(item.image.height * item.scale.y * dpiRatio) * WORLD_UNITS_PER_PIXEL),
  };
}

export function isRenderableImage(item: OBRImage): boolean {
  if (!item.image.mime.startsWith("image/")) return false;
  return item.layer === "MAP" || item.layer === "PROP" || item.layer === "CHARACTER" || item.layer === "MOUNT";
}
