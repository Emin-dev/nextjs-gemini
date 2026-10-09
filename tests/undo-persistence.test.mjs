// Deterministic regression coverage of the actual useUndoableActions and
// useLocalStorage sources, transpiled with the existing TypeScript dependency.
// Run: node --test tests/undo-persistence.test.mjs
// Negative control: UNDO_PERSISTENCE_SOURCE_ROOT=/path/to/pre-repair/repo node --test tests/undo-persistence.test.mjs
//
// The helper is a minimal hook/effect/clock/storage model, not React or a browser.
// These tests prove serialized data and deadline behavior in that model, not
// hydration, DOM behavior, concurrent React/Strict Mode, or browser lifecycle.
// Separate act() calls represent separate rendered interactions. Multiple calls
// within one act retain the actual generic storage hook's render-closure setter;
// this repair does not address its existing batched-callback/stale-state limits.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createUndoHarness } from "./helpers/undo-hook-harness.mjs";

const sourceRoot = path.resolve(process.env.UNDO_PERSISTENCE_SOURCE_ROOT ??
  fileURLToPath(new URL("../", import.meta.url)));
const START = 1_800_000_000_000;
const STORAGE_KEY = "todoAppUndoableActions";

function todo(id, extra = {}) {
  return {
    id, text: `Task ${id}`, completed: false, isDeleted: false,
    markedForDeletionAt: null, pendingFinalDeletionTimestamp: null, stage2BatchId: null,
    ...extra,
  };
}

function action(id, timestamp, extra = {}) {
  return { id, originalTodo: todo(id), actionType: "delete", timestamp, ...extra };
}

function mount(t, options = {}) {
  const harness = createUndoHarness({ sourceRoot, now: START, ...options });
  t.after(() => harness.unmount());
  return harness;
}

function stored(harness) {
  const raw = harness.storage.get(STORAGE_KEY);
  assert.equal(typeof raw, "string", "undo storage key must contain JSON");
  const record = JSON.parse(raw);
  assert.equal(Object.getPrototypeOf(record), Object.prototype, "storage must be a plain JSON object");
  return record;
}

function ids(harness) {
  assert.ok(harness.result.undoableActions instanceof Map, "public API must remain a Map");
  return [...harness.result.undoableActions.keys()].sort((a, b) => a - b);
}

test("new actions round-trip complete plain records through actual localStorage hook", (t) => {
  const original = todo(11, { text: "Retain my original snapshot", completed: true });
  const first = mount(t);
  assert.equal(first.constants.UNDOABLE_ACTIONS_STORAGE_KEY, STORAGE_KEY);
  assert.equal(first.constants.UNDO_TIMEOUT, 20_000);
  first.act((hook) => hook.addUndoableAction(original));
  const expected = { "11": action(11, START, { originalTodo: { ...original } }) };
  assert.deepEqual(stored(first), expected);
  assert.deepEqual(first.result.undoableActions.get(11), expected["11"]);
  original.text = "Changed after marking";
  assert.equal(first.result.undoableActions.get(11).originalTodo.text, "Retain my original snapshot");
  first.unmount();
  const reloaded = mount(t, { storage: first.storage });
  assert.deepEqual(ids(reloaded), [11]);
  assert.deepEqual(reloaded.result.undoableActions.get(11), expected["11"]);
  assert.deepEqual(stored(reloaded), expected);
});

test("existing plain records hydrate numeric IDs without rewriting timestamps", (t) => {
  const record = { "3": action(3, START - 8_000), "19": action(19, START - 2_000) };
  const raw = JSON.stringify(record);
  const harness = mount(t, { storage: new Map([[STORAGE_KEY, raw]]) });
  assert.deepEqual(ids(harness), [3, 19]);
  assert.deepEqual(harness.result.undoableActions.get(3), record["3"]);
  assert.equal(harness.storage.get(STORAGE_KEY), raw);
  assert.deepEqual(harness.deadlines, [START + 12_000, START + 18_000]);
});

test("legacy empty JSON remains safely empty and accepts a new pending action", (t) => {
  const harness = mount(t, { storage: new Map([[STORAGE_KEY, "{}"]]) });
  assert.deepEqual(ids(harness), []);
  assert.deepEqual(harness.deadlines, []);
  assert.deepEqual(stored(harness), {});
  harness.act((hook) => hook.addUndoableAction(todo(7)));
  assert.deepEqual(stored(harness), { "7": action(7, START) });
});

test("independent pending actions persist together and expire at their own deadlines", (t) => {
  const harness = mount(t);
  harness.act((hook) => hook.addUndoableAction(todo(1)));
  harness.advanceTo(START + 3_000);
  harness.act((hook) => hook.addUndoableAction(todo(2)));
  assert.deepEqual(stored(harness), { "1": action(1, START), "2": action(2, START + 3_000) });
  assert.deepEqual(harness.deadlines, [START + 20_000, START + 23_000]);
  harness.advanceTo(START + 19_999);
  assert.deepEqual(ids(harness), [1, 2]);
  harness.advanceTo(START + 20_000);
  assert.deepEqual(ids(harness), [2]);
  assert.deepEqual(stored(harness), { "2": action(2, START + 3_000) });
  harness.advanceTo(START + 22_999);
  assert.deepEqual(ids(harness), [2]);
  harness.advanceTo(START + 23_000);
  assert.deepEqual(ids(harness), []);
  assert.deepEqual(stored(harness), {});
  assert.deepEqual(harness.deadlines, []);
});

test("clear returns the original action, persists other entries, and cancels its timeout", (t) => {
  const record = { "4": action(4, START), "5": action(5, START + 1_000) };
  const harness = mount(t, { now: START + 1_000, storage: new Map([[STORAGE_KEY, JSON.stringify(record)]]) });
  const cleared = harness.act((hook) => hook.clearSpecificUndoAction(4, true, "Confirmed manually"));
  assert.deepEqual(cleared, record["4"]);
  assert.deepEqual(ids(harness), [5]);
  assert.deepEqual(stored(harness), { "5": record["5"] });
  assert.deepEqual(harness.deadlines, [START + 21_000]);
  assert.deepEqual(harness.messages, ["Confirmed manually"]);
  assert.equal(harness.act((hook) => hook.clearSpecificUndoAction(999)), undefined);
  assert.deepEqual(stored(harness), { "5": record["5"] });
  harness.advanceTo(START + 20_000);
  assert.deepEqual(ids(harness), [5]);
  assert.deepEqual(harness.messages, ["Confirmed manually"]);
});

test("performUndo restores the original todo and persists only unrelated pending entries", (t) => {
  const original = todo(8, {
    text: "Saved before deletion", completed: true, isDeleted: true,
    markedForDeletionAt: START - 500, pendingFinalDeletionTimestamp: START + 60_000, stage2BatchId: "batch-8",
  });
  const other = todo(9);
  const record = { "8": action(8, START, { originalTodo: original }), "9": action(9, START) };
  const harness = mount(t, {
    todos: [todo(8, { text: "Changed pending row", isDeleted: true }), other], currentFilter: "deleted",
    storage: new Map([[STORAGE_KEY, JSON.stringify(record)]]),
  });
  harness.act((hook) => hook.performUndo(8));
  assert.deepEqual(harness.todos, [
    { ...original, markedForDeletionAt: null, isDeleted: false, pendingFinalDeletionTimestamp: null, stage2BatchId: null },
    other,
  ]);
  assert.equal(harness.todos[1], other);
  assert.deepEqual(stored(harness), { "9": record["9"] });
  assert.deepEqual(ids(harness), [9]);
  assert.equal(harness.currentFilter, "all");
  assert.equal(harness.searchQuery, "");
  assert.equal(harness.inactivityResets, 1);
  assert.deepEqual(harness.messages, ['"Saved before deletio..." restored.']);
  harness.unmount();
  const reloaded = mount(t, { storage: harness.storage });
  assert.deepEqual(ids(reloaded), [9]);
});

test("restore undo preserves filter/search behavior and writes an empty record", (t) => {
  const harness = mount(t, { todos: [todo(12, { isDeleted: true })], currentFilter: "deleted" });
  harness.act((hook) => hook.addUndoableAction(todo(12), "restore"));
  assert.equal(stored(harness)["12"].actionType, "restore");
  harness.act((hook) => hook.performUndo(12));
  assert.equal(harness.todos[0].isDeleted, false);
  assert.equal(harness.currentFilter, "deleted");
  assert.equal(harness.searchQuery, "existing search");
  assert.deepEqual(ids(harness), []);
  assert.deepEqual(stored(harness), {});
  assert.deepEqual(harness.deadlines, []);
});

test("hydration prunes expired and invalid entries while persisting live records", (t) => {
  const live = action(23, START - 7_000);
  const record = {
    "20": action(20, START - 20_001),
    "21": action(21, START - 20_000),
    "22": action(22, "invalid timestamp"),
    "23": live,
    "24": null,
    "25": action(25, START, { originalTodo: null }),
  };
  const harness = mount(t, { storage: new Map([[STORAGE_KEY, JSON.stringify(record)]]) });
  assert.deepEqual(ids(harness), [23]);
  assert.deepEqual(stored(harness), { "23": live });
  assert.deepEqual(harness.deadlines, [START + 13_000]);
  harness.unmount();
  const reloaded = mount(t, { storage: harness.storage, now: START + 1_000 });
  assert.deepEqual(ids(reloaded), [23]);
  assert.equal(reloaded.result.undoableActions.get(23).timestamp, START - 7_000);
  assert.deepEqual(reloaded.deadlines, [START + 13_000]);
});

test("an all-expired reload leaves an empty record and no scheduled undo", (t) => {
  const harness = mount(t, { storage: new Map([[STORAGE_KEY, JSON.stringify({ "30": action(30, START - 20_000) })]]) });
  assert.deepEqual(ids(harness), []);
  assert.deepEqual(stored(harness), {});
  assert.deepEqual(harness.deadlines, []);
});

test("reload before expiry preserves the original deadline rather than restarting the window", (t) => {
  const first = mount(t);
  first.act((hook) => hook.addUndoableAction(todo(41)));
  first.advanceTo(START + 8_000);
  const raw = first.storage.get(STORAGE_KEY);
  first.unmount();
  assert.deepEqual(first.deadlines, [], "unmount must cancel the previous instance's timers");
  const reloaded = mount(t, { storage: new Map([[STORAGE_KEY, raw]]), now: START + 8_000 });
  assert.deepEqual(ids(reloaded), [41]);
  assert.equal(reloaded.result.undoableActions.get(41).timestamp, START);
  assert.deepEqual(reloaded.deadlines, [START + 20_000]);
  assert.equal(reloaded.storage.get(STORAGE_KEY), raw);
  reloaded.advanceTo(START + 19_999);
  assert.deepEqual(ids(reloaded), [41]);
  reloaded.advanceTo(START + 20_000);
  assert.deepEqual(ids(reloaded), []);
  assert.deepEqual(stored(reloaded), {});
  assert.deepEqual(reloaded.deadlines, []);
});

test("explicit storage removal clears the key, public Map, and scheduled timers", (t) => {
  const harness = mount(t);
  harness.act((hook) => hook.addUndoableAction(todo(51)));
  assert.deepEqual(stored(harness), { "51": action(51, START) });
  harness.act((hook) => hook.removeUndoableActionsStorage());
  assert.equal(harness.storage.has(STORAGE_KEY), false);
  assert.deepEqual(ids(harness), []);
  assert.deepEqual(harness.deadlines, []);
  const messageCount = harness.messages.length;
  harness.advanceTo(START + 25_000);
  assert.equal(harness.storage.has(STORAGE_KEY), false);
  assert.equal(harness.messages.length, messageCount);
});
