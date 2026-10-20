// Focused complements to Biome, not a replacement for every prior ESLint rule.
// Run with: node --test tests/source-invariants.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));

function parse(text, filename = "fixture.tsx") {
  return ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function nodesWithin(node, predicate) {
  const matches = [];
  function visit(current) {
    if (predicate(current)) matches.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return matches;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(filename) ? [filename] : [];
  });
}

function quotedJsxText(source) {
  return nodesWithin(source, (node) => ts.isJsxText(node) && /["']/.test(node.getText(source)));
}

function emptyInterfaces(source) {
  return nodesWithin(source, (node) => ts.isInterfaceDeclaration(node) &&
    node.members.length === 0 &&
    (node.heritageClauses ?? []).flatMap((clause) => clause.types).length <= 1);
}

function namedCall(node, name) {
  return ts.isCallExpression(node) &&
    ((ts.isIdentifier(node.expression) && node.expression.text === name) ||
      (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name));
}

function isCurrentRead(node, refName) {
  return ts.isPropertyAccessExpression(node) && node.name.text === "current" &&
    ts.isIdentifier(node.expression) && node.expression.text === refName;
}

function timerMapCleanupIssues(source) {
  const issues = [];
  // Derive ref names from useRef(new Map()), so renaming a binding is harmless.
  const mapRefs = nodesWithin(source, (node) => ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) && node.initializer && namedCall(node.initializer, "useRef") &&
    node.initializer.arguments.some((argument) => ts.isNewExpression(argument) &&
      ts.isIdentifier(argument.expression) && argument.expression.text === "Map"))
    .map((node) => node.name.text);
  let checkedEffects = 0;
  for (const call of nodesWithin(source, (node) => namedCall(node, "useEffect"))) {
    const setup = call.arguments[0];
    if (!setup || !(ts.isArrowFunction(setup) || ts.isFunctionExpression(setup)) || !ts.isBlock(setup.body)) continue;
    const cleanupFunctions = setup.body.statements.filter((statement) => ts.isReturnStatement(statement) &&
      statement.expression && (ts.isArrowFunction(statement.expression) || ts.isFunctionExpression(statement.expression)))
      .map((statement) => statement.expression);
    for (const cleanup of cleanupFunctions) {
      const clearsTimers = nodesWithin(cleanup, (node) => namedCall(node, "clearTimeout") ||
        (ts.isCallExpression(node) && node.arguments.some((argument) =>
          ts.isIdentifier(argument) && argument.text === "clearTimeout"))).length > 0;
      if (!clearsTimers) continue;
      for (const refName of mapRefs) {
        if (!nodesWithin(setup, (node) => isCurrentRead(node, refName)).length) continue;
        checkedEffects += 1;
        if (nodesWithin(cleanup, (node) => isCurrentRead(node, refName)).length) {
          issues.push("Timer-map cleanup reads a mutable ref instead of its effect-local snapshot.");
        }
        const capturedNames = setup.body.statements
          .filter(ts.isVariableStatement)
          .filter((statement) => (statement.declarationList.flags & ts.NodeFlags.Const) !== 0)
          .flatMap((statement) => statement.declarationList.declarations)
          .filter((declaration) => ts.isIdentifier(declaration.name) && declaration.initializer &&
            isCurrentRead(declaration.initializer, refName))
          .map((declaration) => declaration.name.text);
        const usesCapturedMap = capturedNames.some((name) => nodesWithin(cleanup, (node) =>
          ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name).length > 0);
        if (!usesCapturedMap) issues.push("Timer-map cleanup must use a const snapshot of the same ref captured in this effect.");
      }
    }
  }
  if (checkedEffects === 0) issues.push("No timer-map effect cleanup was checked; review this guard after restructuring the hook.");
  return issues;
}

function locations(source, nodes) {
  return nodes.map((node) => `${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
}

const appSources = ["app", "components"].flatMap((directory) => sourceFiles(path.join(root, directory)))
  .map((filename) => parse(readFileSync(filename, "utf8"), path.relative(root, filename)));

test("JSX quote check rejects raw quotes but accepts entities and expressions", () => {
  assert.equal(quotedJsxText(parse('<p>Use "Clear Deleted"; don\'t wait.</p>')).length, 1);
  assert.equal(quotedJsxText(parse('<p>Use &quot;Clear Deleted&quot;; don&apos;t wait. {"it\'s fine"}</p>')).length, 0);
});

test("interface check rejects empty and single-base declarations, preserving real shapes and multiple bases", () => {
  const invalid = parse("interface Empty {} interface Alias extends Base {};");
  const valid = parse("interface Shape { name: string } interface Combined extends A, B {} type Alias = Base;");
  assert.equal(emptyInterfaces(invalid).length, 2);
  assert.equal(emptyInterfaces(valid).length, 0);
});

test("timer cleanup check detects late ref reads and wrong snapshots, independent of variable names", () => {
  const fixture = (snapshot, cleanup) => parse(`
    const renamedRef = useRef(new Map());
    useEffect(() => {
      ${snapshot}
      renamedRef.current.set(1, setTimeout(work, 100));
      return () => { ${cleanup} };
    }, []);
  `);
  assert.deepEqual(timerMapCleanupIssues(fixture(
    "const captured = renamedRef.current;", "captured.forEach(clearTimeout);",
  )), []);
  assert.ok(timerMapCleanupIssues(fixture("", "renamedRef.current.forEach(clearTimeout);")).length > 0);
  assert.ok(timerMapCleanupIssues(fixture("const captured = new Map();", "captured.forEach(clearTimeout);")).length > 0);
  assert.ok(timerMapCleanupIssues(fixture("let captured = renamedRef.current;", "captured.forEach(clearTimeout);")).length > 0);
});

test("application JSX text has no raw quote or apostrophe characters", () => {
  assert.deepEqual(appSources.flatMap((source) => locations(source, quotedJsxText(source))), []);
});

test("application interfaces do not contain empty object or redundant single-base declarations", () => {
  assert.deepEqual(appSources.flatMap((source) => locations(source, emptyInterfaces(source))), []);
});

test("undo timer effect cleanup uses the same captured timer map", () => {
  const filename = path.join(root, "app/hooks/useUndoableActions.ts");
  assert.deepEqual(timerMapCleanupIssues(parse(readFileSync(filename, "utf8"), filename)), []);
});
