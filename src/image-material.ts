import * as THREE from "three";

export type ImageRenderKind = "map" | "token" | "prop";

/**
 * Tokens are vertical billboards and must retain the source artwork's colors.
 * MeshStandardMaterial makes their appearance depend on 3D scene lighting,
 * which can turn dark/black tokens nearly invisible. An unlit basic material
 * keeps the Owlbear image faithful while still respecting transparent pixels.
 */
export function createImageMaterial(
  kind: ImageRenderKind,
  placeholderTexture: THREE.Texture,
): THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  if (kind === "token") {
    return new THREE.MeshBasicMaterial({
      map: placeholderTexture,
      color: "#ffffff",
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
  }

  return new THREE.MeshStandardMaterial({
    map: placeholderTexture,
    transparent: false,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}
