export const hashForLog = (value: string): string => {
  let hash = 0x811c9dc5;
  for (const symbol of value) {
    hash ^= symbol.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
