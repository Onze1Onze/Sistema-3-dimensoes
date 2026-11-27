export interface ScenePoint {
  x: number;
  y: number;
}

export interface GridScaleInfo {
  multiplier: number;
  unit: string;
  digits: number;
}

export type SceneShapeTool = "rectangle" | "circle" | "triangle" | "hexagon";

/** Returns the actual map-space outline used by both shape previews and tests. */
export function getSceneShapeVertices(
  tool: SceneShapeTool,
  start: ScenePoint,
  end: ScenePoint,
  requestedSegments = 48,
): ScenePoint[] {
  const { center, width, height } = getSceneToolBounds(start, end);

  if (tool === "rectangle") {
    return [
      { x: center.x - width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y + height / 2 },
      { x: center.x - width / 2, y: center.y + height / 2 },
      { x: center.x - width / 2, y: center.y - height / 2 },
    ];
  }

  if (tool === "triangle") {
    // Match the persisted Three.js/Owlbear triangle: apex at local +Y,
    // which maps to the lower map-space edge after the scene Y/Z inversion.
    return [
      { x: center.x, y: center.y + height / 2 },
      { x: center.x - width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y - height / 2 },
      { x: center.x, y: center.y + height / 2 },
    ];
  }

  if (tool === "hexagon") {
    const vertices = Array.from({ length: 6 }, (_, index) => {
      const angle = (index / 6) * Math.PI * 2;
      return {
        x: center.x + Math.cos(angle) * width / 2,
        y: center.y + Math.sin(angle) * height / 2,
      };
    });
    vertices.push({ ...vertices[0] });
    return vertices;
  }

  const segments = Math.max(12, Math.min(128, Math.floor(requestedSegments)));
  const radius = Math.max(width, height) / 2;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
}

export function formatGridDistance(distance: number, scale?: GridScaleInfo | null): string {
  if (!Number.isFinite(distance)) return "—";
  const multiplier = scale && Number.isFinite(scale.multiplier) && scale.multiplier > 0
    ? scale.multiplier
    : 1;
  const digits = scale && Number.isFinite(scale.digits)
    ? Math.max(0, Math.min(4, Math.floor(scale.digits)))
    : 1;
  const unit = scale?.unit?.trim() ?? "";
  const value = distance * multiplier;
  return unit ? `${value.toFixed(digits)} ${unit}` : value.toFixed(digits);
}

export function filterSceneStrokePoints(points: ScenePoint[], minDistance = 2): ScenePoint[] {
  if (points.length <= 1) return points.map((point) => ({ ...point }));
  const filtered: ScenePoint[] = [{ ...points[0] }];
  const threshold = Math.max(0, minDistance);
  for (let i = 1; i < points.length; i += 1) {
    const previous = filtered[filtered.length - 1];
    const point = points[i];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= threshold || i === points.length - 1) {
      filtered.push({ ...point });
    }
  }
  return filtered;
}

export function getSceneToolBounds(start: ScenePoint, end: ScenePoint): {
  center: ScenePoint;
  width: number;
  height: number;
} {
  return {
    center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    width: Math.max(1, Math.abs(end.x - start.x)),
    height: Math.max(1, Math.abs(end.y - start.y)),
  };
}
