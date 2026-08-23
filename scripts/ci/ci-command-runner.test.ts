import { describe, expect, it, vi } from 'vitest';

import {
  CiCommandExecutionError,
  classifyCiCommandFailure,
  runCiCommand,
} from './ci-command-runner.ts';

const processError = (
  status?: number,
  signal?: string
): Error & { status?: number; signal?: string } =>
  Object.assign(
    new Error('redacted process failure'),
    status === undefined ? {} : { status },
    signal === undefined ? {} : { signal }
  );

describe('ci-command-runner', () => {
  it('does not retry deterministic command failures', () => {
    const execute = vi.fn(() => {
      throw processError(1);
    });

    expect(() => runCiCommand('pnpm nx run example:test:unit', execute)).toThrowError(
      CiCommandExecutionError
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('retries an explicitly classified infrastructure failure once', () => {
    const execute = vi
      .fn<() => void>()
      .mockImplementationOnce(() => {
        throw processError(75);
      })
      .mockImplementationOnce(() => undefined);

    expect(runCiCommand('pnpm nx run example:test:unit', execute)).toMatchObject({
      retryCount: 1,
      attempts: [
        { attempt: 1, classification: 'infrastructure' },
        { attempt: 2, classification: null },
      ],
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry a signalled process without an explicit transient contract', () => {
    const execute = vi.fn(() => {
      throw processError(undefined, 'SIGTERM');
    });

    try {
      runCiCommand('pnpm nx run example:test:unit', execute);
      throw new Error('expected runner to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(CiCommandExecutionError);
      expect(error).toMatchObject({
        classification: 'unknown',
        retryCount: 0,
        attempts: [{ attempt: 1, classification: 'unknown', signal: 'SIGTERM' }],
      });
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fails after one infrastructure retry', () => {
    const execute = vi.fn(() => {
      throw processError(75);
    });

    try {
      runCiCommand('pnpm nx run example:test:unit', execute);
      throw new Error('expected runner to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(CiCommandExecutionError);
      expect(error).toMatchObject({ classification: 'infrastructure', retryCount: 1 });
    }
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry an unclassified failure', () => {
    expect(classifyCiCommandFailure(new Error('unknown'))).toBe('unknown');
    expect(classifyCiCommandFailure(processError(1))).toBe('deterministic');
    expect(classifyCiCommandFailure(processError(75))).toBe('infrastructure');
    expect(classifyCiCommandFailure(processError(undefined, 'SIGTERM'))).toBe('unknown');
  });
});
