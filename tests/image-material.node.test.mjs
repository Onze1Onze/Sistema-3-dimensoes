import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createImageMaterial } from "../src/image-material.ts";

test("tokens usam material não iluminado e mantêm transparência da imagem", () => {
  const texture = new THREE.Texture();
  const material = createImageMaterial("token", texture);

  assert.ok(material instanceof THREE.MeshBasicMaterial);
  assert.equal(material.map, texture);
  assert.equal(material.transparent, true);
  assert.equal(material.alphaTest, 0.08);
  assert.equal(material.depthWrite, false);
  assert.equal(material.toneMapped, false);
  assert.equal(material.color.getHex(), 0xffffff);

  material.dispose();
  texture.dispose();
});

test("mapas e objetos de cenário mantêm material com iluminação", () => {
  const texture = new THREE.Texture();
  const map = createImageMaterial("map", texture);
  const prop = createImageMaterial("prop", texture);

  assert.ok(map instanceof THREE.MeshStandardMaterial);
  assert.ok(prop instanceof THREE.MeshStandardMaterial);
  assert.equal(map.map, texture);
  assert.equal(prop.map, texture);
  assert.equal(map.roughness, 0.95);
  assert.equal(map.metalness, 0);

  map.dispose();
  prop.dispose();
  texture.dispose();
});
