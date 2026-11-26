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

function imageHalfExtents(item: OBRImage): { x: number; y: number } {
  const width = Math.abs(item.image.width * item.scale.x);
  const height = Math.abs(item.image.height * item.scale.y);
  const angle = (item.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    x: (width * cos + height * sin) / 2,
    y: (width * sin + height * cos) / 2,
  };
}

export function calculateSceneFrame(items: Item[]): SceneFrame | null {
  const maps = getSceneImages(items).filter(
    (item) => item.layer === "MAP" && item.image.mime.startsWith("image/") && item.image.width > 0 && item.image.height > 0,
  );
  if (maps.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const map of maps) {
    const half = imageHalfExtents(map);
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

export function mapToWorld(x: number, y: number, frame: SceneFrame): { x: number; z: number } {
  return {
    x: (x - frame.centerX) * WORLD_UNITS_PER_PIXEL,
    z: -(y - frame.centerY) * WORLD_UNITS_PER_PIXEL,
  };
}

export function worldToMap(x: number, z: number, frame: SceneFrame): { x: number; y: number } {
  return {
    x: x / WORLD_UNITS_PER_PIXEL + frame.centerX,
    y: frame.centerY - z / WORLD_UNITS_PER_PIXEL,
  };
}

export function getImageWorldSize(item: OBRImage): { width: number; height: number } {
  return {
    width: Math.max(0.01, Math.abs(item.image.width * item.scale.x) * WORLD_UNITS_PER_PIXEL),
    height: Math.max(0.01, Math.abs(item.image.height * item.scale.y) * WORLD_UNITS_PER_PIXEL),
  };
}

export function isRenderableImage(item: OBRImage): boolean {
  if (!item.image.mime.startsWith("image/")) return false;
  return item.layer === "MAP" || item.layer === "PROP" || item.layer === "CHARACTER" || item.layer === "MOUNT";
}
