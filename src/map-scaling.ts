export interface MapScalePoint {
  x: number;
  y: number;
}

export interface ScalableMapImage {
  id: string;
  position: MapScalePoint;
  scale: MapScalePoint;
}

export interface ScaledMapImage {
  id: string;
  position: MapScalePoint;
  scale: MapScalePoint;
}

const MIN_IMAGE_SCALE = 0.05;
const MAX_IMAGE_SCALE = 20;

function scaleAxis(value: number, factor: number): number {
  if (!Number.isFinite(value)) throw new RangeError("A escala da imagem precisa ser finita.");
  const direction = value < 0 ? -1 : 1;
  const magnitude = Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, Math.abs(value) * factor));
  return direction * magnitude;
}

/** Scale a tiled MAP composition around its shared center without breaking alignment. */
export function scaleMapLayout(
  items: ScalableMapImage[],
  center: MapScalePoint,
  factor: number,
): ScaledMapImage[] {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError("O fator de escala precisa ser um número positivo.");
  }
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new RangeError("O centro do mapa precisa ter coordenadas finitas.");
  }

  return items.map((item) => {
    if (!Number.isFinite(item.position.x) || !Number.isFinite(item.position.y)) {
      throw new RangeError(`A posição do mapa ${item.id} é inválida.`);
    }
    return {
      id: item.id,
      position: {
        x: center.x + (item.position.x - center.x) * factor,
        y: center.y + (item.position.y - center.y) * factor,
      },
      scale: {
        x: scaleAxis(item.scale.x, factor),
        y: scaleAxis(item.scale.y, factor),
      },
    };
  });
}
