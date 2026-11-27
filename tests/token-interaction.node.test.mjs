import test from "node:test";
import assert from "node:assert/strict";
import {
  nextTokenSelection,
  normalizeRotation,
  translateTokenPositions,
  canModifyCharacter,
  intersectRayWithPlane,
  projectViewDeltaToGround,
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

test("respects Owlbear character ownership when Owner Only is enabled", () => {
  assert.equal(canModifyCharacter("PLAYER", true, "player-a", "player-a"), true);
  assert.equal(canModifyCharacter("PLAYER", true, "player-b", "player-a"), false);
  assert.equal(canModifyCharacter("PLAYER", false, "player-b", "player-a"), true);
  assert.equal(canModifyCharacter("GM", true, "player-b", "player-a"), true);
});


test("intersects a camera-facing plane even when the pointer ray is above the floor", () => {
  assert.deepEqual(
    intersectRayWithPlane(
      { x: 0, y: 5, z: 0 },
      { x: 0, y: -1, z: -1 },
      { x: 0, y: 2, z: -3 },
      { x: 0, y: 1, z: 1 },
    ),
    { x: 0, y: 2, z: -3 },
  );
});

test("returns null for a ray parallel to the selection plane", () => {
  assert.equal(
    intersectRayWithPlane(
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 1, z: 0 },
    ),
    null,
  );
});

test("does not accept a plane intersection behind the camera", () => {
  assert.equal(
    intersectRayWithPlane(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -2, z: 0 },
      { x: 0, y: 1, z: 0 },
    ),
    null,
  );
});

test("projects top-down pointer movement directly onto the ground plane", () => {
  assert.deepEqual(
    projectViewDeltaToGround(
      { x: 4, y: 0, z: -7 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
    ),
    { x: 4, z: -7 },
  );
});

test("normalizes vertical screen movement before mapping it onto the ground", () => {
  const diagonal = Math.SQRT1_2;
  const projected = projectViewDeltaToGround(
    { x: 0, y: 7 * diagonal, z: -7 * diagonal },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: diagonal, z: -diagonal },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  );
  assert.ok(Math.abs(projected.x) < 1e-9);
  assert.ok(Math.abs(projected.z + 7) < 1e-9);
});
