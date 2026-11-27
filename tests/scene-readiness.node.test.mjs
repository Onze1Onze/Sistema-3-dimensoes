import test from "node:test";
import assert from "node:assert/strict";
import { watchSceneReadiness } from "../src/scene-readiness.ts";

function createScene(initialReady = true) {
  let listener = null;
  let unsubscribed = false;
  return {
    source: {
      isReady: async () => initialReady,
      onReadyChange(callback) {
        listener = callback;
        return () => {
          unsubscribed = true;
          listener = null;
        };
      },
    },
    emit(ready) {
      listener?.(ready);
    },
    get unsubscribed() {
      return unsubscribed;
    },
  };
}

test("consulta a cena depois de registrar o listener de mudança", async () => {
  let listenerRegistered = false;
  const states = [];
  const scene = {
    onReadyChange(callback) {
      listenerRegistered = true;
      return () => {};
    },
    async isReady() {
      assert.equal(listenerRegistered, true);
      return true;
    },
  };

  watchSceneReadiness(scene, (ready) => states.push(ready), (error) => assert.fail(String(error)));
  await Promise.resolve();
  assert.deepEqual(states, [true]);
});

test("habilita o estado quando a cena termina de carregar depois do SDK", async () => {
  const scene = createScene(false);
  const states = [];
  watchSceneReadiness(scene.source, (ready) => states.push(ready), (error) => assert.fail(String(error)));

  await Promise.resolve();
  assert.deepEqual(states, [false]);

  scene.emit(true);
  assert.deepEqual(states, [false, true]);
});

test("um resultado inicial atrasado não sobrescreve um evento mais recente", async () => {
  let resolveInitial;
  const initialState = new Promise((resolve) => {
    resolveInitial = resolve;
  });
  let listener = null;
  const states = [];
  const source = {
    isReady: () => initialState,
    onReadyChange(callback) {
      listener = callback;
      return () => {};
    },
  };

  watchSceneReadiness(source, (ready) => states.push(ready), (error) => assert.fail(String(error)));
  listener(true);
  resolveInitial(false);
  await Promise.resolve();

  assert.deepEqual(states, [true]);
});

test("desabilita o estado quando a cena é fechada", async () => {
  const scene = createScene(true);
  const states = [];
  watchSceneReadiness(scene.source, (ready) => states.push(ready), (error) => assert.fail(String(error)));

  await Promise.resolve();
  scene.emit(false);
  assert.deepEqual(states, [true, false]);
});

test("ignora atualizações depois de cancelar a inscrição", async () => {
  const scene = createScene(true);
  const states = [];
  const unsubscribe = watchSceneReadiness(
    scene.source,
    (ready) => states.push(ready),
    (error) => assert.fail(String(error)),
  );

  unsubscribe();
  scene.emit(false);
  await Promise.resolve();

  assert.deepEqual(states, []);
  assert.equal(scene.unsubscribed, true);
});

test("encaminha falha da consulta inicial ao callback de erro", async () => {
  const expectedError = new Error("Falha simulada");
  const scene = {
    isReady: () => Promise.reject(expectedError),
    onReadyChange: () => () => {},
  };
  const errors = [];

  watchSceneReadiness(scene, () => assert.fail("Não deveria receber estado"), (error) => errors.push(error));
  await Promise.resolve();

  assert.deepEqual(errors, [expectedError]);
});
