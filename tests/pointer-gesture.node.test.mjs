import test from "node:test";
import assert from "node:assert/strict";
import { PointerDragGesture } from "../src/pointer-gesture.ts";

test("tracks finger movement while the Owlbear interaction is still starting", () => {
  const gesture = new PointerDragGesture(12, { clientX: 100, clientY: 200 });
  gesture.move({ clientX: 110, clientY: 220 });
  assert.equal(gesture.shouldMove, true);
  assert.deepEqual(gesture.current, { clientX: 110, clientY: 220 });
});

test("keeps the final finger position when released before interaction startup finishes", () => {
  const gesture = new PointerDragGesture(4, { clientX: 30, clientY: 50 });
  gesture.move({ clientX: 42, clientY: 68 });
  gesture.release({ clientX: 55, clientY: 80 });

  assert.equal(gesture.released, true);
  assert.equal(gesture.shouldMove, true);
  assert.deepEqual(gesture.current, { clientX: 55, clientY: 80 });
});

test("does not treat a tap as a drag", () => {
  const gesture = new PointerDragGesture(5, { clientX: 10, clientY: 10 });
  gesture.move({ clientX: 11, clientY: 12 });
  gesture.release({ clientX: 11, clientY: 12 });

  assert.equal(gesture.moved, false);
  assert.equal(gesture.shouldMove, false);
});

test("cancels a gesture and ignores future pointer movement", () => {
  const gesture = new PointerDragGesture(8, { clientX: 10, clientY: 10 });
  gesture.cancel();
  gesture.move({ clientX: 40, clientY: 50 });
  gesture.release({ clientX: 45, clientY: 55 });

  assert.equal(gesture.isActive, false);
  assert.equal(gesture.shouldMove, false);
  assert.deepEqual(gesture.current, { clientX: 10, clientY: 10 });
});

test("does not request an interaction before the movement threshold", () => {
  const gesture = new PointerDragGesture(15, { clientX: 10, clientY: 10 });
  gesture.move({ clientX: 12, clientY: 11 });
  assert.equal(gesture.requestStart(), false);
  assert.equal(gesture.startRequested, false);
});

test("requests the interaction once after meaningful movement", () => {
  const gesture = new PointerDragGesture(16, { clientX: 10, clientY: 10 });
  gesture.move({ clientX: 14, clientY: 10 });
  assert.equal(gesture.requestStart(), true);
  assert.equal(gesture.requestStart(), false);
  assert.equal(gesture.startRequested, true);
});

test("can request startup after release when the final point crossed the threshold", () => {
  const gesture = new PointerDragGesture(17, { clientX: 10, clientY: 10 });
  gesture.release({ clientX: 20, clientY: 25 });
  assert.equal(gesture.requestStart(), true);
  assert.equal(gesture.requestStart(), false);
});

test("does not request startup after cancellation", () => {
  const gesture = new PointerDragGesture(18, { clientX: 10, clientY: 10 });
  gesture.move({ clientX: 20, clientY: 10 });
  gesture.cancel();
  assert.equal(gesture.requestStart(), false);
});

test("does not overwrite the last point after pointer release", () => {
  const gesture = new PointerDragGesture(9, { clientX: 1, clientY: 2 });
  gesture.release({ clientX: 15, clientY: 22 });
  gesture.move({ clientX: 90, clientY: 90 });

  assert.deepEqual(gesture.current, { clientX: 15, clientY: 22 });
});
