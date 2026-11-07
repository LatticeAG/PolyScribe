
// Node emits this warning when a dependency loads node:sqlite. Keep all other
// warnings visible, including other ExperimentalWarnings.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning: string | Error, ...args: unknown[]): void {
  const type = typeof args[0] === "string"
    ? args[0]
    : (args[0] as { type?: string } | undefined)?.type;
  if (
    typeof warning === "string" &&
    warning === "SQLite is an experimental feature and might change at any time" &&
    type === "ExperimentalWarning"
  ) return;
  Reflect.apply(emitWarning, process, [warning, ...args]);
} as typeof process.emitWarning;

const program = await import("./program.js");
export const createProgram = program.createProgram;
export const run = program.run;
