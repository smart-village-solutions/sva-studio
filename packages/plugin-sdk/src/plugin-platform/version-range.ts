const parseVersion = (
  rawVersion: string
): { readonly major: number; readonly minor: number; readonly patch: number } | undefined => {
  const match = rawVersion.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return undefined;
  }

  return {
    major: Number.parseInt(match[1] ?? '', 10),
    minor: Number.parseInt(match[2] ?? '', 10),
    patch: Number.parseInt(match[3] ?? '', 10),
  };
};

const compareVersions = (
  left: { readonly major: number; readonly minor: number; readonly patch: number },
  right: { readonly major: number; readonly minor: number; readonly patch: number }
): number => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
};

export const satisfiesVersionRange = (version: string, range: string): boolean => {
  const normalizedRange = range.trim();
  if (normalizedRange === '*') {
    return true;
  }

  const parsedVersion = parseVersion(version);
  if (!parsedVersion) {
    return false;
  }

  if (normalizedRange.startsWith('^')) {
    const baseVersion = parseVersion(normalizedRange.slice(1));
    if (!baseVersion) {
      return false;
    }
    if (compareVersions(parsedVersion, baseVersion) < 0) {
      return false;
    }

    if (baseVersion.major > 0) {
      return parsedVersion.major === baseVersion.major;
    }
    if (baseVersion.minor > 0) {
      return parsedVersion.major === 0 && parsedVersion.minor === baseVersion.minor;
    }

    return (
      parsedVersion.major === 0 &&
      parsedVersion.minor === 0 &&
      parsedVersion.patch === baseVersion.patch
    );
  }

  const exactVersion = parseVersion(normalizedRange);
  return exactVersion ? compareVersions(parsedVersion, exactVersion) === 0 : false;
};
