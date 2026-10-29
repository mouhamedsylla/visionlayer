import { test } from "node:test";
import assert from "node:assert/strict";
import { cliArgs } from "../vision/cli/args.js";

function withArgv(argv: string[], fn: () => void): void {
  const original = process.argv;
  process.argv = ["node", "script.js", ...argv];
  try {
    fn();
  } finally {
    process.argv = original;
  }
}

test("cliArgs: retire un `--` littéral (pnpm ne le fait pas, contrairement à npm)", () => {
  withArgv(["--", "/tmp/mon-essai"], () => {
    assert.deepStrictEqual(cliArgs(), ["/tmp/mon-essai"]);
  });
});

test("cliArgs: ne retire rien s'il n'y a pas de `--`", () => {
  withArgv(["--task", "x", "/tmp/mon-essai"], () => {
    assert.deepStrictEqual(cliArgs(), ["--task", "x", "/tmp/mon-essai"]);
  });
});

test("cliArgs: retire tous les `--` s'il y en a plusieurs", () => {
  withArgv(["--", "--task", "x", "--"], () => {
    assert.deepStrictEqual(cliArgs(), ["--task", "x"]);
  });
});
