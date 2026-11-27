import test from "node:test";
import assert from "node:assert/strict";
import { filterSceneStrokePoints, formatGridDistance, getSceneToolBounds } from "../src/scene-tools.ts";

test("formata distância usando a escala nativa da grade", () => {
  assert.equal(formatGridDistance(3, { multiplier: 5, unit: "ft", digits: 0 }), "15 ft");
  assert.equal(formatGridDistance(2.5, { multiplier: 1.5, unit: "m", digits: 2 }), "3.75 m");
});

test("mantém precisão quando a cena usa medida euclidiana", () => {
  assert.equal(formatGridDistance(1.234, { multiplier: 5, unit: "ft", digits: 2 }), "6.17 ft");
});

test("usa fallback seguro quando a escala não está disponível", () => {
  assert.equal(formatGridDistance(2.5), "2.5");
  assert.equal(formatGridDistance(Number.NaN), "—");
});

test("filtra pontos muito próximos sem alterar a entrada", () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 0 }, { x: 5.5, y: 0 }];
  const result = filterSceneStrokePoints(points, 2);
  assert.deepEqual(result, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5.5, y: 0 }]);
  assert.equal(points.length, 4);
});

test("calcula centro e dimensões para formas desenhadas no plano 3D", () => {
  assert.deepEqual(getSceneToolBounds({ x: 10, y: 40 }, { x: 110, y: 90 }), {
    center: { x: 60, y: 65 },
    width: 100,
    height: 50,
  });
});

test("evita formas com largura e altura zero", () => {
  assert.deepEqual(getSceneToolBounds({ x: 50, y: 50 }, { x: 50, y: 50 }), {
    center: { x: 50, y: 50 },
    width: 1,
    height: 1,
  });
});
