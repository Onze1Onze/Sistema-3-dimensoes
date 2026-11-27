import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateSceneFrame, getImageWorldSize, getSceneCounts, mapToWorld, worldToMap } from '../src/scene-model.ts';

function imageItem(overrides = {}) {
  return {
    id: 'map-1', type: 'IMAGE', name: 'Map', visible: true, locked: true,
    createdUserId: 'gm', zIndex: 0, lastModified: '2026-01-01T00:00:00.000Z',
    lastModifiedUserId: 'gm', position: { x: 500, y: 400 }, rotation: 0,
    scale: { x: 1, y: 1 }, metadata: {}, layer: 'MAP',
    image: { width: 1000, height: 800, mime: 'image/png', url: 'https://example.com/map.png' },
    grid: { offset: { x: 0, y: 0 }, dpi: 100 }, text: { plainText: '' }, textItemType: 'LABEL',
    ...overrides,
  };
}

test('calcula enquadramento de mapa centralizado', () => {
  const frame = calculateSceneFrame([imageItem()]);
  assert.equal(frame.centerX, 500);
  assert.equal(frame.centerY, 400);
  assert.equal(frame.width, 1000);
  assert.equal(frame.height, 800);
});

test('considera rotação para determinar limites do mapa', () => {
  const frame = calculateSceneFrame([imageItem({ rotation: 90 })]);
  assert.ok(Math.abs(frame.width - 800) < 1e-8);
  assert.ok(Math.abs(frame.height - 1000) < 1e-8);
});

test('converte coordenadas 2D para 3D e de volta sem desvio', () => {
  const frame = calculateSceneFrame([imageItem()]);
  const world = mapToWorld(750, 200, frame);
  assert.ok(Math.abs(world.x - 2.5) < 1e-8);
  assert.ok(Math.abs(world.z - 2) < 1e-8);
  const restored = worldToMap(world.x, world.z, frame);
  assert.ok(Math.abs(restored.x - 750) < 1e-8);
  assert.ok(Math.abs(restored.y - 200) < 1e-8);
});

test('retorna null quando não existe imagem MAP', () => {
  assert.equal(calculateSceneFrame([imageItem({ layer: 'CHARACTER' })]), null);
});

test('preserva escala e proporção de miniaturas', () => {
  const token = imageItem({
    layer: 'CHARACTER',
    image: { width: 200, height: 300, mime: 'image/png', url: 'https://example.com/token.png' },
    scale: { x: 0.5, y: 0.5 },
  });
  assert.deepEqual(getImageWorldSize(token), { width: 1, height: 1.5 });
});

test('conta apenas imagens visíveis', () => {
  const counts = getSceneCounts([
    imageItem(),
    imageItem({ id: 'token-1', layer: 'CHARACTER' }),
    imageItem({ id: 'prop-1', layer: 'PROP' }),
    imageItem({ id: 'hidden', layer: 'CHARACTER', visible: false }),
  ]);
  assert.deepEqual(counts, { maps: 1, tokens: 1, props: 1 });
});

test('manifest é JSON válido e aponta para a página inicial', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.action.popover, 'https://onze1onze.github.io/Sistema-3-dimensoes/index.html');
  assert.equal(manifest.icon, 'https://onze1onze.github.io/Sistema-3-dimensoes/icon.svg');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, '1.1.1');
  assert.equal(packageJson.version, manifest.version);
  assert.match(manifest.icon, /^https:\/\/onze1onze\.github\.io\//);
});
