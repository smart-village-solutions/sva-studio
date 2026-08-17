import { describe, expect, it } from 'vitest';

import { injectWorkerDatabaseSecret } from './inject-worker-database-secret.ts';

describe('worker database secret injection', () => {
  const secret = 'worker-password-with-at-least-32-characters';

  it('adds the dedicated secret without changing existing config values', () => {
    expect(injectWorkerDatabaseSecret('APP_DB_PASSWORD=existing\nAPP_DB_USER=sva_app\n', secret)).toBe(
      `APP_DB_PASSWORD=existing\nAPP_DB_USER=sva_app\nSTUDIO_JOB_WORKER_DB_PASSWORD=${secret}\n`
    );
  });

  it('replaces a legacy bundled worker password with the dedicated secret', () => {
    const source = 'STUDIO_JOB_WORKER_DB_PASSWORD=legacy\nAPP_DB_USER=sva_app\n';

    expect(injectWorkerDatabaseSecret(source, secret)).not.toContain('legacy');
    expect(injectWorkerDatabaseSecret(source, secret)).toContain(`STUDIO_JOB_WORKER_DB_PASSWORD=${secret}`);
  });

  it.each(['', 'too-short', `valid-looking-secret-with-more-than-32-characters\nsecond-line`])(
    'rejects an unsafe secret value',
    (value) => {
      expect(() => injectWorkerDatabaseSecret('APP_DB_USER=sva_app\n', value)).toThrow();
    }
  );

  it('rejects reuse of an existing database password', () => {
    expect(() => injectWorkerDatabaseSecret(`APP_DB_PASSWORD=${secret}\n`, secret)).toThrow(/unterscheiden/u);
  });

  it('does not let the dedicated secret conceal an empty selected config', () => {
    expect(() => injectWorkerDatabaseSecret('', secret)).toThrow(/Konfiguration ist leer/u);
  });
});
