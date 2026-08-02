import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderComposeEnv, runRenderComposeEnv } from './render-compose-env.ts';

describe('render-compose-env', () => {
  it('quotes literal secret values so Compose does not interpolate dollar sequences', () => {
    expect(renderComposeEnv('FIRST_VALUE=literal$$value\nSECOND_VALUE=$UNRESOLVED')).toBe(
      "FIRST_VALUE='literal$$value'\nSECOND_VALUE='$UNRESOLVED'\n"
    );
  });

  it('uses Compose-compatible double quotes for values containing apostrophes', () => {
    expect(renderComposeEnv('TOKEN= a=b#c \\ it\'s "$VALID" ')).toBe(
      `TOKEN=" a=b#c \\\\ it's \\"$$VALID\\" "\n`
    );
  });

  it('ignores blank lines and comments but rejects malformed keys', () => {
    expect(renderComposeEnv('# comment\n\nVALID=value')).toBe("VALID='value'\n");
    expect(() => renderComposeEnv('INVALID-KEY=value')).toThrow(/Ungültiger APP_CONFIG-Schlüssel/u);
  });

  it('reads the selected config from a protected input file', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'render-compose-env-'));
    const input = resolve(directory, 'input.vars');
    const output = resolve(directory, '.env');
    try {
      writeFileSync(input, 'VALUE=from-file\n');
      expect(runRenderComposeEnv(['--input', input, '--output', output], 'VALUE=legacy')).toBe(0);
      expect(readFileSync(output, 'utf8')).toBe("VALUE='from-file'\n");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
