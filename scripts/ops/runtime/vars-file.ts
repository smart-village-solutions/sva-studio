import { readFileSync } from 'node:fs';

const isWrappedInQuote = (rawValue: string, quote: '"' | "'") =>
  rawValue.startsWith(quote) && rawValue.endsWith(quote);

const unquoteVarsValue = (rawValue: string): string => {
  if (isWrappedInQuote(rawValue, '"') || isWrappedInQuote(rawValue, "'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
};

const parseVarsLine = (rawLine: string): readonly [string, string] | null => {
  const line = rawLine.trim();
  if (line.length === 0 || line.startsWith('#')) {
    return null;
  }

  const separatorIndex = line.indexOf('=');
  if (separatorIndex < 1) {
    return null;
  }

  const key = line.slice(0, separatorIndex).trim();
  const value = unquoteVarsValue(line.slice(separatorIndex + 1).trim());
  return [key, value];
};

export const parseVarsFile = (filePath: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const parsedLine = parseVarsLine(rawLine);
    if (!parsedLine) {
      continue;
    }

    const [key, value] = parsedLine;
    parsed[key] = value;
  }

  return parsed;
};
