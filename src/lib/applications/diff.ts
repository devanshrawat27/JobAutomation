export type SnapshotFact = {
  key: string;
  label: string;
  value: string;
};

export type ProfileChange = {
  key: string;
  label: string;
  from: string | null;
  to: string | null;
};

export type ProfileDiff = {
  added: ProfileChange[];
  removed: ProfileChange[];
  changed: ProfileChange[];
  total: number;
};

/**
 * Compare the facts pinned when an application was tracked with the facts now.
 *
 * A fact that moved from confirmed to skipped simply disappears from the current
 * set, which is reported as removed rather than silently ignored.
 */
export function diffProfile(snapshot: SnapshotFact[], current: SnapshotFact[]): ProfileDiff {
  const before = new Map(snapshot.map((fact) => [fact.key, fact]));
  const after = new Map(current.map((fact) => [fact.key, fact]));

  const added: ProfileChange[] = [];
  const removed: ProfileChange[] = [];
  const changed: ProfileChange[] = [];

  for (const [key, fact] of after) {
    const previous = before.get(key);
    if (!previous) {
      added.push({ key, label: fact.label, from: null, to: fact.value });
      continue;
    }
    if (previous.value !== fact.value) {
      changed.push({ key, label: fact.label, from: previous.value, to: fact.value });
    }
  }

  for (const [key, fact] of before) {
    if (!after.has(key)) removed.push({ key, label: fact.label, from: fact.value, to: null });
  }

  return { added, removed, changed, total: added.length + removed.length + changed.length };
}
