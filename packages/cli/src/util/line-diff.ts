import pc from "picocolors";

function longestCommonSubsequence(a: string[], b: string[]): number[][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i]![j] = table[i - 1]![j - 1]! + 1;
      } else {
        table[i]![j] = Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
      }
    }
  }

  return table;
}

type DiffOp =
  | { type: "equal"; line: string }
  | { type: "remove"; line: string }
  | { type: "add"; line: string };

function diffLines(before: string[], after: string[]): DiffOp[] {
  const table = longestCommonSubsequence(before, after);
  const ops: DiffOp[] = [];
  let i = before.length;
  let j = after.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      ops.push({ type: "equal", line: before[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i]![j - 1]! >= table[i - 1]![j]!)) {
      ops.push({ type: "add", line: after[j - 1]! });
      j--;
    } else {
      ops.push({ type: "remove", line: before[i - 1]! });
      i--;
    }
  }

  return ops.reverse();
}

export function renderLineDiff(before: string, after: string): string {
  const ops = diffLines(before.split("\n"), after.split("\n"));

  return ops
    .map((op) => {
      switch (op.type) {
        case "equal":
          return pc.dim(` ${op.line}`);
        case "remove":
          return pc.red(`-${op.line}`);
        case "add":
          return pc.green(`+${op.line}`);
      }
    })
    .join("\n");
}
