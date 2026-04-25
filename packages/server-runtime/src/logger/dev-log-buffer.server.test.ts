import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendDevelopmentLogEntry,
  readDevelopmentLogEntries,
  resetDevelopmentLogBufferForTests,
} from './dev-log-buffer.server.js';

describe('development log buffer', () => {
  beforeEach(() => {
    resetDevelopmentLogBufferForTests();
  });

  it('appends serializable entries and supports afterId queries', () => {
    const first = appendDevelopmentLogEntry({
      timestamp: '2026-01-01T00:00:00.000Z',
      level: 'info',
      source: 'server',
      message: 'first',
      context: {
        date: new Date('2026-01-01T00:00:00.000Z'),
        error: new Error('boom'),
        nested: { value: true },
        list: [1, undefined],
      },
    });
    const second = appendDevelopmentLogEntry({
      timestamp: '2026-01-01T00:00:01.000Z',
      level: 'warn',
      source: 'server',
      message: 'second',
    });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(readDevelopmentLogEntries()).toHaveLength(2);
    expect(readDevelopmentLogEntries({ afterId: 1 })).toEqual([second]);
    expect(first.context).toMatchObject({
      date: '2026-01-01T00:00:00.000Z',
      error: {
        name: 'Error',
        message: 'boom',
      },
      list: [1, null],
    });
  });

  it('keeps only the newest development log entries', () => {
    for (let index = 0; index < 405; index += 1) {
      appendDevelopmentLogEntry({
        timestamp: '2026-01-01T00:00:00.000Z',
        level: 'debug',
        source: 'server',
        message: `entry-${index}`,
      });
    }

    const entries = readDevelopmentLogEntries();
    expect(entries).toHaveLength(400);
    expect(entries[0]?.id).toBe(6);
    expect(entries.at(-1)?.id).toBe(405);
  });
});
