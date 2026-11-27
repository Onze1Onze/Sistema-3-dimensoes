import test from "node:test";
import assert from "node:assert/strict";
import {
  nextTokenSelection,
  normalizeRotation,
  translateTokenPositions,
} from "../src/token-interaction.ts";

test("seleciona apenas o token clicado sem modificadores", () => {
  assert.deepEqual(
    nextTokenSelection(["token-a", "token-b"], "token-c", { additive: false, toggle: false }),
    ["token-c"],
  );
});

test("adiciona um token à seleção com Shift", () => {
  assert.deepEqual(
    nextTokenSelection(["token-a"], "token-b", { additive: true, toggle: false }),
    ["token-a", "token-b"],
  );
});

test("não duplica um token já selecionado com Shift", () => {
  assert.deepEqual(
    nextTokenSelection(["token-a", "token-b"], "token-b", { additive: true, toggle: false }),
    ["token-a", "token-b"],
  );
});

test("Ctrl/Cmd alterna a presença do token na seleção", () => {
  assert.deepEqual(
    nextTokenSelection(["token-a", "token-b"], "token-a", { additive: false, toggle: true }),
    ["token-b"],
  );
  assert.deepEqual(
    nextTokenSelection(["token-a"], "token-b", { additive: false, toggle: true }),
    ["token-a", "token-b"],
  );
});

test("move vários tokens preservando a distância relativa entre eles", () => {
  const moved = translateTokenPositions(
    [
      { id: "token-a", x: 100, y: 150 },
      { id: "token-b", x: 300, y: 450 },
    ],
    { x: 25, y: -40 },
  );
  assert.deepEqual(moved, [
    { id: "token-a", x: 125, y: 110 },
    { id: "token-b", x: 325, y: 410 },
  ]);
});

test("não muta as posições originais durante o arraste em grupo", () => {
  const initial = [{ id: "token-a", x: 10, y: 20 }];
  translateTokenPositions(initial, { x: 4, y: 5 });
  assert.deepEqual(initial, [{ id: "token-a", x: 10, y: 20 }]);
});

test("normaliza rotações positivas e negativas", () => {
  assert.equal(normalizeRotation(375), 15);
  assert.equal(normalizeRotation(-15), 345);
  assert.equal(normalizeRotation(720), 0);
});
