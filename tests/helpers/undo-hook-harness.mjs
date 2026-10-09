import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Script } from "node:vm";
import ts from "typescript";

// Deliberately small deterministic harness, not a React renderer. It runs the
// actual TypeScript hooks and their actual localStorage setter closures. State
// changes are rendered after an act/timer callback; effects compare dependencies
// and clean up before rerunning. This does not emulate concurrent rendering,
// Strict Mode, browser storage events, or every React update scheduling detail.
export function createUndoHarness({ sourceRoot, now, storage = new Map(), todos = [], currentFilter = "all" }) {
  let time = now;
  let timerId = 0;
  let cursor = 0;
  let dirty = true;
  let mounted = true;
  let output;
  let pendingEffects = [];
  let currentTodos = todos;
  let searchQuery = "existing search";
  let inactivityResets = 0;
  const slots = [];
  const timers = new Map();
  const messages = [];
  const storageWrites = [];

  function slot(kind, initialize) {
    const index = cursor++;
    if (!slots[index]) {
      slots[index] = initialize();
      slots[index].kind = kind;
    }
    assert.equal(slots[index].kind, kind, "hook order changed");
    return slots[index];
  }

  function sameDependencies(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => Object.is(value, right[index]));
  }

  function useMemo(factory, dependencies) {
    const state = slot("memo", () => ({ initialized: false }));
    if (!state.initialized || !sameDependencies(state.dependencies, dependencies)) {
      state.value = factory();
      state.dependencies = dependencies;
      state.initialized = true;
    }
    return state.value;
  }

  const react = {
    useState(initialValue) {
      const state = slot("state", () => {
        const result = { value: typeof initialValue === "function" ? initialValue() : initialValue };
        result.set = (next) => {
          const value = typeof next === "function" ? next(result.value) : next;
          if (!Object.is(value, result.value)) {
            result.value = value;
            dirty = true;
          }
        };
        return result;
      });
      return [state.value, state.set];
    },
    useRef(initialValue) {
      return slot("ref", () => ({ value: { current: initialValue } })).value;
    },
    useMemo,
    useCallback(callback, dependencies) {
      return useMemo(() => callback, dependencies);
    },
    useEffect(setup, dependencies) {
      const state = slot("effect", () => ({ initialized: false }));
      if (!state.initialized || !sameDependencies(state.dependencies, dependencies)) {
        state.dependencies = dependencies;
        state.initialized = true;
        pendingEffects.push({ state, setup });
      }
    },
  };

  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      const serialized = String(value);
      storage.set(key, serialized);
      storageWrites.push({ key, serialized });
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  class ClockDate extends Date {
    static now() {
      return time;
    }
  }

  function setTimeoutFake(callback, delay) {
    const id = ++timerId;
    timers.set(id, { id, due: time + Math.max(0, Number(delay)), callback });
    return id;
  }

  const modules = new Map();
  const allowedFiles = new Set([
    "app/hooks/useUndoableActions.ts",
    "app/hooks/useLocalStorage.ts",
    "app/lib/constants.ts",
  ].map((relative) => path.resolve(sourceRoot, relative)));

  function loadModule(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    assert.ok(allowedFiles.has(filename), `unexpected module in hook test: ${filename}`);
    const source = readFileSync(filename, "utf8");
    const compiled = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
      reportDiagnostics: true,
    });
    assert.deepEqual(compiled.diagnostics, [], `TypeScript transpilation diagnostics in ${filename}`);
    const module = { exports: {} };
    modules.set(filename, module);
    const requireModule = (specifier) => {
      if (specifier === "react") return react;
      assert.ok(specifier.startsWith("."), `unexpected hook dependency: ${specifier}`);
      return loadModule(path.resolve(path.dirname(filename), `${specifier}.ts`));
    };
    // Same JS realm as the assertions, with lexical clock/storage injection.
    // No global monkey-patching, generated files, or copied hook algorithms.
    const execute = new Script(
      `(function(require, module, exports, window, Date, setTimeout, clearTimeout) {\n${compiled.outputText}\n})`,
      { filename },
    ).runInThisContext();
    execute(requireModule, module, module.exports, { localStorage }, ClockDate,
      setTimeoutFake, (id) => timers.delete(id));
    return module.exports;
  }

  const constants = loadModule(path.resolve(sourceRoot, "app/lib/constants.ts"));
  // This export is the complete unit rendered by our simulated dispatcher.
  const { useUndoableActions: renderUndoActions } = loadModule(path.resolve(sourceRoot, "app/hooks/useUndoableActions.ts"));
  const props = {
    showStatusMessage: (message) => messages.push(message),
    setTodos: (next) => { currentTodos = typeof next === "function" ? next(currentTodos) : next; },
    currentFilter,
    setFilter: (filter) => { props.currentFilter = filter; dirty = true; },
    setSearchQuery: (query) => { searchQuery = query; },
    focusInput: () => {},
    resetInactivityTimer: () => { inactivityResets += 1; },
  };

  function flush() {
    assert.ok(mounted, "cannot render an unmounted harness");
    let renders = 0;
    while (dirty) {
      assert.ok(++renders < 25, "effects failed to settle");
      dirty = false;
      cursor = 0;
      pendingEffects = [];
      output = renderUndoActions(props);
      const effects = pendingEffects;
      for (const { state } of effects) state.cleanup?.();
      for (const { state, setup } of effects) state.cleanup = setup();
    }
  }

  flush();
  return {
    constants,
    storage,
    storageWrites,
    messages,
    get result() { return output; },
    get now() { return time; },
    get todos() { return currentTodos; },
    get currentFilter() { return props.currentFilter; },
    get searchQuery() { return searchQuery; },
    get inactivityResets() { return inactivityResets; },
    get deadlines() { return [...timers.values()].map((timer) => timer.due).sort((a, b) => a - b); },
    act(callback) {
      assert.ok(mounted, "cannot act after unmount");
      const returned = callback(output);
      flush();
      return returned;
    },
    advanceTo(target) {
      assert.ok(target >= time, "clock cannot move backwards");
      let callbacks = 0;
      for (;;) {
        const next = [...timers.values()].filter((timer) => timer.due <= target)
          .sort((left, right) => left.due - right.due || left.id - right.id)[0];
        if (!next) break;
        assert.ok(++callbacks < 100, "timers failed to settle");
        time = next.due;
        timers.delete(next.id);
        next.callback();
        flush();
      }
      time = target;
    },
    unmount() {
      for (const state of slots) {
        if (state.kind === "effect") state.cleanup?.();
      }
      mounted = false;
    },
  };
}
