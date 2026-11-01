export type DiffLine = {
  type: "same" | "added" | "removed";
  text: string;
};

/**
 * Line diff between two document versions (longest common subsequence).
 *
 * Bounded to 400 lines each, which is far more than any resume or letter and
 * keeps the table small.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n").slice(0, 400);
  const b = after.split("\n").slice(0, 400);
  const n = a.length;
  const m = b.length;

  const table: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: "removed", text: a[i] });
      i += 1;
    } else {
      result.push({ type: "added", text: b[j] });
      j += 1;
    }
  }

  while (i < n) {
    result.push({ type: "removed", text: a[i] });
    i += 1;
  }
  while (j < m) {
    result.push({ type: "added", text: b[j] });
    j += 1;
  }

  return result;
}
