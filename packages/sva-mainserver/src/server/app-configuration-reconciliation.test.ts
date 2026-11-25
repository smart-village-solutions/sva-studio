import { describe, expect, it } from 'vitest';
import type { AppConfigurationSave } from '../app-configuration.js';
import {
  readAppConfigurationFields,
  reconcileAppConfiguration,
} from './app-configuration-reconciliation.js';

const original =
  '{"settings":{"locationService":{"showAlternativeLocationButton":false}},"appDesignSystem":{"serviceTiles":{"numberOfLines":2}},"foreign":[9007199254740993,null,false],"duplicate":1,"duplicate":2}';
const baseline = readAppConfigurationFields(original)!;
const input: AppConfigurationSave = {
  id: '3',
  baselineRevision: 'old',
  baseline,
  changes: { tileTitleLines: 4 },
};
const compare = (raw: string, revision: string, overrides: Partial<AppConfigurationSave> = {}) =>
  reconcileAppConfiguration(raw, readAppConfigurationFields(raw)!, revision, {
    ...input,
    ...overrides,
  });

describe('App configuration reconciliation', () => {
  it('preserves raw values and duplicate keys outside the changed path', () => {
    expect(compare(original, 'old')).toEqual({
      status: 'ready',
      content: original.replace('"numberOfLines":2', '"numberOfLines":4'),
    });
  });

  it('warns before applying a disjoint edit to the current record', () => {
    const current = original.replace('Button":false', 'Button":true');
    expect(compare(current, 'new')).toEqual({ status: 'review', conflicts: [] });
    expect(compare(current, 'new', { reviewedRevision: 'new' })).toEqual({
      status: 'ready',
      content: current.replace('"numberOfLines":2', '"numberOfLines":4'),
    });
  });

  it('requires an explicit decision per conflict and ties it to the reviewed revision', () => {
    const current = original.replace('"numberOfLines":2', '"numberOfLines":3');
    expect(compare(current, 'new')).toEqual({ status: 'review', conflicts: ['tileTitleLines'] });
    expect(
      compare(current, 'new', {
        reviewedRevision: 'another',
        choices: { tileTitleLines: 'studio' },
      })
    ).toEqual({ status: 'review', conflicts: ['tileTitleLines'] });
    expect(
      compare(current, 'new', {
        reviewedRevision: 'new',
        choices: { tileTitleLines: 'mainserver' },
      })
    ).toEqual({ status: 'ready', content: current });
    expect(
      compare(current, 'new', { reviewedRevision: 'new', choices: { tileTitleLines: 'studio' } })
    ).toEqual({
      status: 'ready',
      content: current.replace('"numberOfLines":3', '"numberOfLines":4'),
    });
  });

  it('distinguishes removal, missing values and unsupported overlapping structures', () => {
    const removed = compare(original, 'old', { changes: { tileTitleLines: null } });
    expect(
      removed.status === 'ready' && readAppConfigurationFields(removed.content)?.tileTitleLines
    ).toEqual({ state: 'missing' });
    const duplicate = original.replace('"numberOfLines":2', '"numberOfLines":2,"numberOfLines":3');
    expect(compare(duplicate, 'new')).toEqual({ status: 'unsupported' });
    expect(readAppConfigurationFields('{"x":1,}')).toBeNull();
  });
});
