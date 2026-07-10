import { describe, expect, it } from 'vitest';

import { renderComposeEnv } from './render-compose-env.ts';

describe('render-compose-env', () => {
  it('quotes literal secret values so Compose does not interpolate dollar sequences', () => {
    expect(renderComposeEnv('FIRST_VALUE=literal$$value\nSECOND_VALUE=$UNRESOLVED')).toBe(
      "FIRST_VALUE='literal$$value'\nSECOND_VALUE='$UNRESOLVED'\n"
    );
  });

  it('uses Compose-compatible double quotes for values containing apostrophes', () => {
    expect(renderComposeEnv('TOKEN= a=b#c \\ it\'s "$VALID" ')).toBe(
      'TOKEN=" a=b#c \\\\ it\'s \\\"$$VALID\\\" "\n'
    );
  });

  it('ignores blank lines and comments but rejects malformed keys', () => {
    expect(renderComposeEnv('# comment\n\nVALID=value')).toBe("VALID='value'\n");
    expect(() => renderComposeEnv('INVALID-KEY=value')).toThrow(/Ungültiger APP_CONFIG-Schlüssel/u);
  });
});
