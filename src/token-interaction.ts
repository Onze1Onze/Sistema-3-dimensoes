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

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** Interseção de um raio semi-infinito com um plano, sem depender do Three.js. */
export function intersectRayWithPlane(
  rayOrigin: Vector3Like,
  rayDirection: Vector3Like,
  planePoint: Vector3Like,
  planeNormal: Vector3Like,
): Vector3Like | null {
  const denominator =
    rayDirection.x * planeNormal.x +
    rayDirection.y * planeNormal.y +
    rayDirection.z * planeNormal.z;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-8) return null;

  const distance = (
    (planePoint.x - rayOrigin.x) * planeNormal.x +
    (planePoint.y - rayOrigin.y) * planeNormal.y +
    (planePoint.z - rayOrigin.z) * planeNormal.z
  ) / denominator;
  if (!Number.isFinite(distance) || distance < 0) return null;

  const point = {
    x: rayOrigin.x + rayDirection.x * distance,
    y: rayOrigin.y + rayDirection.y * distance,
    z: rayOrigin.z + rayDirection.z * distance,
  };
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
    ? point
    : null;
}

/** Converte componentes da câmera em um deslocamento horizontal sem foreshortening. */
export function projectViewDeltaToGround(
  viewDelta: Vector3Like,
  cameraRight: Vector3Like,
  cameraUp: Vector3Like,
  groundRight: Vector3Like,
  groundUp: Vector3Like,
): { x: number; z: number } {
  const horizontalAmount =
    viewDelta.x * cameraRight.x +
    viewDelta.y * cameraRight.y +
    viewDelta.z * cameraRight.z;
  const verticalAmount =
    viewDelta.x * cameraUp.x +
    viewDelta.y * cameraUp.y +
    viewDelta.z * cameraUp.z;
  return {
    x: horizontalAmount * groundRight.x + verticalAmount * groundUp.x,
    z: horizontalAmount * groundRight.z + verticalAmount * groundUp.z,
  };
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

/** Applies Owlbear's CHARACTER_OWNER_ONLY rule before attempting an update. */
export function canModifyCharacter(
  role: "GM" | "PLAYER",
  ownerOnly: boolean,
  itemOwnerId: string,
  playerId: string,
): boolean {
  return role === "GM" || !ownerOnly || itemOwnerId === playerId;
}
