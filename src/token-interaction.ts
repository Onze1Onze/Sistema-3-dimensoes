export interface TokenSelectionModifiers {
  additive: boolean;
  toggle: boolean;
}

export interface TokenPosition {
  id: string;
  x: number;
  y: number;
}

export interface TokenMoveDelta {
  x: number;
  y: number;
}

/** Calcula seleção 3D sem alterar a seleção recebida. */
export function nextTokenSelection(
  currentIds: string[],
  tokenId: string,
  modifiers: TokenSelectionModifiers,
): string[] {
  if (modifiers.toggle) {
    return currentIds.includes(tokenId)
      ? currentIds.filter((id) => id !== tokenId)
      : [...currentIds, tokenId];
  }

  if (modifiers.additive) {
    return currentIds.includes(tokenId) ? currentIds : [...currentIds, tokenId];
  }

  return [tokenId];
}

/** Move um conjunto de tokens pela mesma distância, preservando suas posições relativas. */
export function translateTokenPositions(
  initialPositions: TokenPosition[],
  delta: TokenMoveDelta,
): TokenPosition[] {
  return initialPositions.map((position) => ({
    id: position.id,
    x: position.x + delta.x,
    y: position.y + delta.y,
  }));
}

/** Normaliza ângulos para o intervalo [0, 360). */
export function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
