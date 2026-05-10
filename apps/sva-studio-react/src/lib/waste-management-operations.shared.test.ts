import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildOperationSummary,
  createSqlExecutor,
  defaultReadBinarySource,
  ensureRequiredColumns,
  parseBoolean,
  parseCustomDates,
  parseDelimitedStringArray,
  parseFollowUpMode,
  parseReasonType,
  parseRecurrence,
  quoteIdentifier,
} from './waste-management-operations.shared.js';

describe('waste-management operations shared helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('quotes valid identifiers and rejects invalid schema names', () => {
    expect(quoteIdentifier('waste_schema_1')).toBe('"waste_schema_1"');
    expect(() => quoteIdentifier('waste-schema')).toThrowError('invalid_waste_schema:waste-schema');
  });

  it('adapts nullable query results into deterministic sql execution results', async () => {
    const query = vi.fn(async () => ({
      rowCount: null,
      rows: [{ id: 'row-1' }],
    }));

    const result = await createSqlExecutor({ query }).execute({
      text: 'select 1',
      values: ['value'],
    });

    expect(query).toHaveBeenCalledWith('select 1', ['value']);
    expect(result).toEqual({
      rowCount: 0,
      rows: [{ id: 'row-1' }],
    });
  });

  it('parses booleans, delimited values and custom dates defensively', () => {
    expect(parseBoolean(' YES ', 'enabled')).toBe(true);
    expect(parseBoolean('0', 'enabled')).toBe(false);
    expect(() => parseBoolean('maybe', 'enabled')).toThrowError('invalid_boolean:enabled');

    expect(parseDelimitedStringArray(undefined)).toEqual([]);
    expect(parseDelimitedStringArray(' one | | two | three ')).toEqual(['one', 'two', 'three']);
    expect(parseCustomDates(undefined)).toBeUndefined();
    expect(parseCustomDates('2026-05-01 | 2026-05-08')).toEqual([
      { date: '2026-05-01' },
      { date: '2026-05-08' },
    ]);
  });

  it('validates required import columns and typed recurrence values', () => {
    expect(() =>
      ensureRequiredColumns(['region_id'], [{ key: 'city_id' }], 'waste-management.geografie-abholorte')
    ).toThrowError('missing_import_column:waste-management.geografie-abholorte:city_id');
    expect(() =>
      ensureRequiredColumns(['region_id', 'city_id'], [{ key: 'city_id' }], 'waste-management.geografie-abholorte')
    ).not.toThrow();

    expect(parseRecurrence(' custom ')).toBe('custom');
    expect(parseRecurrence(' ')).toBeUndefined();
    expect(() => parseRecurrence('monthly')).toThrowError('invalid_recurrence:monthly');
  });

  it('validates reason and follow-up contract enums', () => {
    const contract = {
      isDateShiftReasonType: (value: string): value is 'holiday' => value === 'holiday',
      isTourDateShiftFollowUpMode: (value: string): value is 'skip' => value === 'skip',
    };

    expect(parseReasonType(contract, ' holiday ')).toBe('holiday');
    expect(parseReasonType(contract, ' ')).toBeUndefined();
    expect(() => parseReasonType(contract, 'weather')).toThrowError('invalid_reason_type:weather');

    expect(parseFollowUpMode(contract, ' skip ')).toBe('skip');
    expect(parseFollowUpMode(contract, undefined)).toBeUndefined();
    expect(() => parseFollowUpMode(contract, 'duplicate')).toThrowError('invalid_follow_up_mode:duplicate');
  });

  it('reads inline data urls and rejects unsupported blob urls', async () => {
    await expect(defaultReadBinarySource('data:text/plain,Hallo%20Welt')).resolves.toEqual(
      Buffer.from('Hallo Welt', 'utf8')
    );
    await expect(defaultReadBinarySource('data:text/plain;base64,SGFsbG8=')).resolves.toEqual(
      Buffer.from('Hallo', 'utf8')
    );
    await expect(defaultReadBinarySource('data:text/plain;base64')).rejects.toThrowError('invalid_blob_ref:data_url');
    await expect(defaultReadBinarySource('blob:temporary')).rejects.toThrowError('unsupported_blob_ref:blob_url');
  });

  it('builds operation summaries with a minimum duration of one millisecond', () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(1_005);

    expect(buildOperationSummary(1_000, { imported: 3 })).toEqual({
      durationMs: 5,
      details: { imported: 3 },
    });

    dateNow.mockReturnValue(999);
    expect(buildOperationSummary(1_000, { imported: 0 })).toEqual({
      durationMs: 1,
      details: { imported: 0 },
    });
  });
});
