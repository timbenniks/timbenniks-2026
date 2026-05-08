type Dated = { data: { date: Date } };

export function yearsActive(entries: Dated[]): number {
  if (!entries.length) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (const e of entries) {
    const y = e.data.date.getFullYear();
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return max - min + 1;
}
