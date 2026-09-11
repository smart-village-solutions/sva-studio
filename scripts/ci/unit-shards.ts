/** Deterministic project sharding; each existing Nx target stays indivisible and cacheable. */
export interface UnitShard {
  index: number;
  count: number;
}

export const parseUnitShard = (value: string): UnitShard => {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/u.exec(value);
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || index > count) {
    throw new Error(`Ungültiger Unit-Shard: ${value}; erwartet index/count (1-basiert).`);
  }
  return { index, count };
};

export const unitShardId = ({ index, count }: UnitShard): string =>
  `unit-remaining-${index}-of-${count}`;

export const selectRemainingUnitProjects = (
  projects: readonly string[],
  shard: UnitShard
): string[] => {
  // Validate programmatic callers as well as CLI input.
  parseUnitShard(`${shard.index}/${shard.count}`);
  const sorted = [...new Set(projects)].sort();
  if (shard.count === 1) return sorted;
  // The app is the longest target in the measured full fallback. Isolate it
  // without changing its test selection, command or Nx cache key.
  const app = 'sva-studio-react';
  if (shard.index === 1) return sorted.filter((project) => project === app);
  return sorted
    .filter((project) => project !== app)
    .filter((_project, index) => index % (shard.count - 1) === shard.index - 2);
};
