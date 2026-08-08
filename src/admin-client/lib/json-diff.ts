/**
 * Tiny unified-style text diff for pretty-printed JSON.
 * Used on the Changes desk so local drafts can be reviewed before publish.
 */

export interface JsonDiffResult {
  /** Unified diff body (no file headers), or empty when identical. */
  patch: string;
  additions: number;
  deletions: number;
}

function linesOf(value: unknown): string[] {
  if (value === undefined) return [];
  return JSON.stringify(value, null, 2).split('\n');
}

/** LCS line diff — page/site JSON is small enough for O(nm). */
function diffLines(a: string[], b: string[]): Array<{ type: 'eq' | 'del' | 'add'; line: string }> {
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const out: Array<{ type: 'eq' | 'del' | 'add'; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'eq', line: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: 'del', line: a[i]! });
      i++;
    } else {
      out.push({ type: 'add', line: b[j]! });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: 'del', line: a[i]! });
    i++;
  }
  while (j < m) {
    out.push({ type: 'add', line: b[j]! });
    j++;
  }
  return out;
}

/**
 * Diff two JSON-serializable values as a compact unified patch.
 * Collapses long equal runs to `@@` context markers (3 lines of context).
 */
export function diffJson(before: unknown, after: unknown, context = 3): JsonDiffResult {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return { patch: '', additions: 0, deletions: 0 };
  }

  const a = linesOf(before);
  const b = linesOf(after);
  const raw = diffLines(a, b);

  let additions = 0;
  let deletions = 0;
  for (const row of raw) {
    if (row.type === 'add') additions++;
    else if (row.type === 'del') deletions++;
  }

  const keep = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i]!.type !== 'eq') {
      for (let j = Math.max(0, i - context); j <= Math.min(raw.length - 1, i + context); j++) {
        keep[j] = 1;
      }
    }
  }

  const parts: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (!keep[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < raw.length && keep[i]) i++;
    parts.push('@@ … @@');
    for (let j = start; j < i; j++) {
      const row = raw[j]!;
      if (row.type === 'eq') parts.push(` ${row.line}`);
      else if (row.type === 'del') parts.push(`-${row.line}`);
      else parts.push(`+${row.line}`);
    }
  }

  return { patch: parts.join('\n'), additions, deletions };
}

/** Colorize a unified patch for `<pre class="diff-patch">` (HTML-escaped). */
export function formatPatchHtml(patch: string, escapeHtml: (s: unknown) => string): string {
  if (!patch) return '';
  return patch
    .split('\n')
    .map((line) => {
      const esc = escapeHtml(line);
      if (line.startsWith('+') && !line.startsWith('+++')) {
        return `<span class="diff-add">${esc}</span>`;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        return `<span class="diff-del">${esc}</span>`;
      }
      if (line.startsWith('@@')) {
        return `<span class="diff-hunk">${esc}</span>`;
      }
      return esc;
    })
    .join('\n');
}
