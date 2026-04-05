import { spawnSync } from 'node:child_process';

const stripControlArtifacts = (value: string) => value.replaceAll('\u0000', '');

const stripAnsiArtifacts = (value: string) => {
  const escapeChar = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeChar}\\[[0-9;?]*[ -/]*[@-~]`, 'gu'), '');
};

const stripCaretControlArtifacts = (value: string) => value.replaceAll('^@', '');

export const sanitizeProcessOutput = (value: string) =>
  stripCaretControlArtifacts(stripAnsiArtifacts(stripControlArtifacts(value)));

export const filterRemoteOutputLines = (value: string) =>
  sanitizeProcessOutput(value)
    .replace(/\ntime=.*level=/gu, '\ntime=')
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => !/^time=.*level=/u.test(entry))
    .filter((entry) => entry !== 'standard input')
    .filter((entry) => !/^~+$/u.test(entry));

export const summarizeProcessOutput = (value: string, maxLines = 40) => {
  const lines = filterRemoteOutputLines(value);
  return lines.slice(-maxLines).join('\n');
};

const parseMarkedOutput = (output: string, marker: string) => {
  const cleaned = sanitizeProcessOutput(output);
  const startMarker = `${marker}_START`;
  const endMarker = `${marker}_END`;
  const startIndex = cleaned.lastIndexOf(startMarker);
  const endIndex = startIndex === -1 ? -1 : cleaned.indexOf(endMarker, startIndex + startMarker.length);

  if (startIndex === -1) {
    throw new Error(`Markierte Ausgabe ${marker} nicht gefunden.`);
  }

  const segment = cleaned.slice(startIndex + startMarker.length, endIndex === -1 ? undefined : endIndex);
  const lines = filterRemoteOutputLines(segment.replace(/^\n+/u, '').trimStart()).filter(
    (entry) => entry !== startMarker && entry !== endMarker,
  );

  if (lines.length > 0) {
    return lines.join('\n');
  }

  const boolMatrixMatches = Array.from(segment.matchAll(/(?:t|f)(?:\|(?:t|f)){3,}/gu)).map((match) => match[0]);
  if (boolMatrixMatches.length > 0) {
    return boolMatrixMatches.at(-1) ?? boolMatrixMatches[0];
  }

  const statusMatches = Array.from(segment.matchAll(/\b(?:ok|applied:[^\s]+)\b/gu)).map((match) => match[0]);
  if (statusMatches.length > 0) {
    return statusMatches.join('\n');
  }

  throw new Error(`Markierte Ausgabe ${marker} enthält keine auswertbaren Daten.`);
};

const isRetryableQuantumTransportFailure = (value: string) => {
  const normalized = sanitizeProcessOutput(value).toLowerCase();
  return (
    normalized.includes('broken pipe') ||
    normalized.includes('connection reset by peer') ||
    normalized.includes('websocket: close') ||
    normalized.includes('bad close code 1006')
  );
};

export const withoutDebugEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const sanitized = { ...env };
  delete sanitized.DEBUG;
  return sanitized;
};

export const run = (rootDir: string, commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${commandName} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
};

export const runCapture = (
  rootDir: string,
  commandName: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${commandName} ${args.join(' ')} failed`);
  }

  return result.stdout.trim();
};

export const runCaptureDetailed = (
  rootDir: string,
  commandName: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
) =>
  spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    encoding: 'utf8',
  });

export const commandExists = (rootDir: string, commandName: string) =>
  spawnSync(commandName, ['--help'], {
    cwd: rootDir,
    stdio: 'ignore',
  }).status === 0;

export const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

export const runQuantumExec = (
  rootDir: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options?: {
    marker?: string;
    failureMessage: string;
  }
) => {
  const maxAttempts = options?.marker ? 6 : 1;
  let lastCombined = '';
  let lastMarkerError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runCaptureDetailed(rootDir, 'quantum-cli', args, withoutDebugEnv(env));
    const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    lastCombined = combined;

    if (options?.marker) {
      try {
        return parseMarkedOutput(combined, options.marker);
      } catch (error) {
        lastMarkerError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxAttempts) {
          spawnSync('sleep', ['1'], { cwd: rootDir, stdio: 'ignore' });
          continue;
        }
        throw new Error(
          summarizeProcessOutput(combined) ||
            lastMarkerError.message ||
            options.failureMessage ||
            'quantum-cli exec lieferte keine markierte Ausgabe.'
        );
      }
    } else if (result.status === 0) {
      return summarizeProcessOutput(combined);
    }

    if (result.status !== 0 && attempt < maxAttempts && isRetryableQuantumTransportFailure(combined)) {
      continue;
    }

    if (result.status !== 0) {
      throw new Error(summarizeProcessOutput(combined) || options?.failureMessage || 'quantum-cli exec fehlgeschlagen.');
    }

    return summarizeProcessOutput(combined);
  }

  throw new Error(
    summarizeProcessOutput(lastCombined) ||
      lastMarkerError?.message ||
      options?.failureMessage ||
      'quantum-cli exec fehlgeschlagen.'
  );
};
