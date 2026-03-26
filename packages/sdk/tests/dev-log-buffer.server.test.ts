import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendDevelopmentLogEntry,
  readDevelopmentLogEntries,
  resetDevelopmentLogBufferForTests,
} from '../src/logger/dev-log-buffer.server';

describe('development log buffer', () => {
  beforeEach(() => {
    resetDevelopmentLogBufferForTests();
  });

  it('stores and filters development log entries by id', () => {
    const first = appendDevelopmentLogEntry({
      timestamp: '2026-03-25T10:00:00.000Z',
      level: 'info',
      source: 'server',
      message: 'first',
      component: 'alpha',
    });
    appendDevelopmentLogEntry({
      timestamp: '2026-03-25T10:00:01.000Z',
      level: 'error',
      source: 'server',
      message: 'second',
      component: 'beta',
      context: {
        retry_count: 2,
      },
    });

    expect(readDevelopmentLogEntries()).toHaveLength(2);
    expect(readDevelopmentLogEntries({ afterId: first.id })).toEqual([
      expect.objectContaining({
        message: 'second',
        component: 'beta',
      }),
    ]);
  });

  it('serializes dates and errors while falling back for non-plain objects', () => {
    class CustomDiagnostic {
      toString() {
        return 'custom-diagnostic';
      }
    }

    appendDevelopmentLogEntry({
      timestamp: '2026-03-25T10:00:00.000Z',
      level: 'error',
      source: 'server',
      message: 'third',
      component: 'gamma',
      context: {
        occurred_at: new Date('2026-03-25T10:00:00.000Z'),
        failure: Object.assign(new Error('boom'), { code: 'E_TEST' }),
        diagnostic: new CustomDiagnostic(),
      },
    });

    expect(readDevelopmentLogEntries()[0]?.context).toEqual({
      occurred_at: '2026-03-25T10:00:00.000Z',
      failure: expect.objectContaining({
        name: 'Error',
        message: 'boom',
        code: 'E_TEST',
      }),
      diagnostic: 'custom-diagnostic',
    });
  });
});
