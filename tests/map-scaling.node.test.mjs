import test from "node:test";
import assert from "node:assert/strict";
import { scaleMapLayout } from "../src/map-scaling.ts";

test("dimensiona peças de mapa como um conjunto em torno do centro comum", () => {
  const result = scaleMapLayout([
    { id: "left", position: { x: 100, y: 200 }, scale: { x: 1, y: 1 } },
    { id: "right", position: { x: 300, y: 200 }, scale: { x: 2, y: 0.5 } },
  ], { x: 200, y: 200 }, 1.5);

  assert.deepEqual(result, [
    { id: "left", position: { x: 50, y: 200 }, scale: { x: 1.5, y: 1.5 } },
    { id: "right", position: { x: 350, y: 200 }, scale: { x: 3, y: 0.75 } },
  ]);
});

test("mantém a posição do mapa único e altera sua escala", () => {
  const result = scaleMapLayout([
    { id: "map", position: { x: 500, y: 400 }, scale: { x: 1, y: 1 } },
  ], { x: 500, y: 400 }, 1.25);

  assert.deepEqual(result[0], {
    id: "map",
    position: { x: 500, y: 400 },
    scale: { x: 1.25, y: 1.25 },
  });
});

test("preserva inversões e limita a escala do item aos limites suportados", () => {
  const result = scaleMapLayout([
    { id: "flipped", position: { x: 0, y: 0 }, scale: { x: -19, y: 0.01 } },
  ], { x: 0, y: 0 }, 2);

  assert.deepEqual(result[0].scale, { x: -20, y: 0.05 });
});

test("rejeita fatores e centros inválidos", () => {
  const item = [{ id: "map", position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }];
  assert.throws(() => scaleMapLayout(item, { x: 0, y: 0 }, 0), RangeError);
  assert.throws(() => scaleMapLayout(item, { x: Number.NaN, y: 0 }, 1.2), RangeError);
});
