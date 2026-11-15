/** Behavioral proof of scoped, lossless App configuration write preparation. */
import { describe, expect, it } from 'vitest';

import {
  reconcileAppConfigurationFields,
  prepareAppConfigurationVersionCopy,
  verifyAppConfigurationReadback,
  type AppConfigurationReconciliationInput,
  type AppConfigurationSnapshot,
} from './static-content-reconciliation.js';

const generalField = 'settings.locationService.showAlternativeLocationButton' as const;
const designField = 'appDesignSystem.serviceTiles.numberOfLines' as const;
const snapshot = (content: string): AppConfigurationSnapshot => ({
  instanceId: 'instance-a',
  id: 'static-42',
  name: 'globalSettings',
  dataType: 'json',
  version: '5.0.0',
  content,
});

describe('prepareAppConfigurationVersionCopy', () => {
  const content =
    '{"settings":{"locationService":{"showAlternativeLocationButton":true}},"foreign":{"huge":900719925474099312345,"list":[null,false,2]}}';
  const source = snapshot(content);
  const metadata = {
    instanceId: source.instanceId,
    id: source.id,
    name: source.name,
    dataType: source.dataType,
    version: source.version,
  };
  const input = {
    scope: 'general',
    source,
    currentSource: source,
    targetVersion: '6.0.0',
    existingVariants: [metadata],
    changes: [],
  };

  it('copies all raw content to a new identity without modifying the source', () => {
    const result = prepareAppConfigurationVersionCopy(input);
    expect(result).toEqual({
      status: 'ready',
      sourceId: source.id,
      changedFields: [],
      target: {
        instanceId: source.instanceId,
        name: source.name,
        dataType: 'json',
        version: '6.0.0',
        content,
      },
    });
    if (result.status !== 'ready') throw new Error('copy_preparation_failed');
    expect(result.target).not.toHaveProperty('id');
    expect(source.content).toBe(content);
  });

  it('applies owned edits while preserving all foreign source values', () => {
    const result = prepareAppConfigurationVersionCopy({
      ...input,
      changes: [{ field: generalField, operation: 'set', value: false }],
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('copy_preparation_failed');
    expect(result.changedFields).toEqual([generalField]);
    expect(result.target.content).toContain('"showAlternativeLocationButton":false');
    expect(result.target.content).toContain('"huge":900719925474099312345');
    expect(result.target.content).toContain('"list":[null,false,2]');
    expect(source.content).toBe(content);
  });

  it('requires a new preview if any confirmed source content has changed', () => {
    expect(
      prepareAppConfigurationVersionCopy({
        ...input,
        currentSource: { ...source, content: content.replace('[null,false,2]', '[null,false,3]') },
      })
    ).toEqual({ status: 'conflict', reason: 'source_changed' });
  });

  it.each(['5.0.0', '6.0.0', null])(
    'does not turn an existing target into an update: %s',
    (targetVersion) => {
      expect(
        prepareAppConfigurationVersionCopy({
          ...input,
          targetVersion,
          existingVariants: [
            metadata,
            { ...metadata, id: 'existing-target', version: targetVersion },
          ],
        })
      ).toEqual({ status: 'conflict', reason: 'target_exists' });
    }
  );

  it('can copy to an unversioned target if the supplied inventory contains none', () => {
    const result = prepareAppConfigurationVersionCopy({ ...input, targetVersion: null });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('copy_preparation_failed');
    expect(result.target).toMatchObject({ version: null, content });
  });

  it('rejects another source identity, foreign inventory and an unlisted source', () => {
    for (const change of [
      { currentSource: { ...source, id: 'other' } },
      { currentSource: { ...source, instanceId: 'other-instance' } },
      { currentSource: { ...source, version: null } },
      { existingVariants: [{ ...metadata, instanceId: 'other-instance' }] },
      { existingVariants: [{ ...metadata, id: 'other' }] },
      { existingVariants: [] },
    ])
      expect(prepareAppConfigurationVersionCopy({ ...input, ...change })).toEqual({
        status: 'invalid',
        code: 'identity_mismatch',
      });
  });

  it('rejects invalid requests and foreign field edits', () => {
    expect(prepareAppConfigurationVersionCopy({ ...input, targetVersion: '' })).toEqual({
      status: 'invalid',
      code: 'invalid_request',
    });
    expect(
      prepareAppConfigurationVersionCopy({
        ...input,
        changes: [{ field: designField, operation: 'set', value: 5 }],
      })
    ).toEqual({ status: 'invalid', code: 'field_not_owned' });
    const invalid = { ...source, content: '{' };
    expect(
      prepareAppConfigurationVersionCopy({ ...input, source: invalid, currentSource: invalid })
    ).toEqual({ status: 'invalid', code: 'invalid_document' });
  });
});

describe('verifyAppConfigurationReadback', () => {
  const expected = snapshot('{"secret":"private-value","large":900719925474099312345}');

  it('confirms an exact supplied read for versioned and unversioned records', () => {
    for (const version of ['5.0.0', null]) {
      const record = { ...expected, version };
      expect(
        verifyAppConfigurationReadback({
          expected: record,
          observed: { status: 'read', snapshot: { ...record } },
        })
      ).toEqual({ status: 'confirmed' });
    }
  });

  it.each(['id', 'instanceId', 'name', 'version'] as const)(
    'rejects a fallback or different identity even with the same content: %s',
    (key) => {
      const snapshot = { ...expected, [key]: key === 'name' ? 'globalsettings' : 'different' };
      expect(
        verifyAppConfigurationReadback({ expected, observed: { status: 'read', snapshot } })
      ).toEqual({ status: 'unconfirmed', reason: 'identity_mismatch' });
    }
  );

  it('detects a raw content difference without exposing any values', () => {
    const result = verifyAppConfigurationReadback({
      expected,
      observed: {
        status: 'read',
        snapshot: { ...expected, content: expected.content.replace('312345', '312346') },
      },
    });
    expect(result).toEqual({ status: 'unconfirmed', reason: 'content_mismatch' });
    expect(JSON.stringify(result)).not.toContain('private-value');
  });

  it.each(['not_found', 'unavailable'])(
    'does not report a write failure or retry on missing readback: %s',
    (status) => {
      expect(verifyAppConfigurationReadback({ expected, observed: { status } })).toEqual({
        status: 'unconfirmed',
        reason: status,
      });
    }
  );

  it('does not accept a mutation ID or an empty fallback object as read evidence', () => {
    for (const observed of [{ id: expected.id }, {}, { status: 'read', snapshot: {} }]) {
      expect(verifyAppConfigurationReadback({ expected, observed })).toEqual({
        status: 'invalid',
        code: 'invalid_request',
      });
    }
  });
});
const prepare = (
  base: string,
  current: string,
  changes: AppConfigurationReconciliationInput['changes'] = [
    { field: generalField, operation: 'set', value: false },
  ],
  scope: AppConfigurationReconciliationInput['scope'] = 'general'
) =>
  reconcileAppConfigurationFields({
    scope,
    base: snapshot(base),
    current: snapshot(current),
    changes,
  });

describe('reconcileAppConfigurationFields', () => {
  const base =
    '{"settings":{"locationService":{"showAlternativeLocationButton":true}},"appDesignSystem":{"serviceTiles":{"numberOfLines":3}}}';

  it('preserves another plugin update and unknown raw JSON tokens in either save order', () => {
    const initial =
      base.slice(0, -1) +
      ',"unknown":{"huge":900719925474099312345,"tiny":1e-1000,"list":[false,null,{"future":true}],"escaped":"\\u0061"}}';
    const designChanges = [{ field: designField, operation: 'set' as const, value: 5 }];
    const designFirst = prepare(initial, initial, designChanges, 'design');
    expect(designFirst.status).toBe('ready');
    if (designFirst.status !== 'ready') throw new Error('design_preparation_failed');
    const generalSecond = prepare(initial, designFirst.content);
    expect(generalSecond.status).toBe('ready');
    if (generalSecond.status !== 'ready') throw new Error('general_preparation_failed');
    const generalFirst = prepare(initial, initial);
    if (generalFirst.status !== 'ready') throw new Error('general_preparation_failed');
    const designSecond = prepare(initial, generalFirst.content, designChanges, 'design');
    expect(designSecond).toEqual({ ...generalSecond, changedFields: [designField] });
    expect(generalSecond.content).toContain('"numberOfLines":5');
    expect(generalSecond.content).toContain('"showAlternativeLocationButton":false');
    expect(generalSecond.content).toContain('"huge":900719925474099312345');
    expect(generalSecond.content).toContain('"tiny":1e-1000');
    expect(generalSecond.content).toContain('"list":[false,null,{"future":true}]');
    expect(generalSecond.content).toContain('"escaped":"\\u0061"');
  });

  it('reports a same-field conflict without returning sensitive snapshot content', () => {
    const current = base.replace('"numberOfLines":3', '"numberOfLines":4');
    const result = prepare(
      base,
      current,
      [{ field: designField, operation: 'set', value: 5 }],
      'design'
    );
    expect(result).toEqual({ status: 'conflict', fields: [designField] });
    expect(JSON.stringify(result)).not.toContain('content');
  });

  it('treats an already applied target as a no-op and retains the exact current text', () => {
    const current = base.replace('"numberOfLines":3', '"numberOfLines":5.0');
    expect(
      prepare(base, current, [{ field: designField, operation: 'set', value: 5 }], 'design')
    ).toEqual({ status: 'ready', content: current, changedFields: [] });
  });

  it('distinguishes missing, null and false and preserves unrelated new siblings', () => {
    const initial = '{"settings":{"locationService":{}}}';
    const current = '{"settings":{"locationService":{"future":null}},"unknown":false}';
    const result = prepare(initial, current);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('preparation_failed');
    expect(JSON.parse(result.content)).toEqual({
      settings: { locationService: { future: null, showAlternativeLocationButton: false } },
      unknown: false,
    });
    const changedToNull = '{"settings":{"locationService":{"showAlternativeLocationButton":null}}}';
    expect(prepare(initial, changedToNull)).toEqual({ status: 'conflict', fields: [generalField] });
  });

  it('removes only the owned leaf while retaining foreign siblings and arrays', () => {
    const initial =
      '{"settings":{"locationService":{"showAlternativeLocationButton":false,"future":[3,2,1]}},"unknown":null}';
    const result = prepare(initial, initial, [{ field: generalField, operation: 'remove' }]);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('preparation_failed');
    expect(JSON.parse(result.content)).toEqual({
      settings: { locationService: { future: [3, 2, 1] } },
      unknown: null,
    });
  });

  it('creates missing object parents without copying defaults or other plugin fields', () => {
    const result = prepare('{}', '{"foreign":false}');
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('preparation_failed');
    expect(JSON.parse(result.content)).toEqual({
      foreign: false,
      settings: { locationService: { showAlternativeLocationButton: false } },
    });
  });

  it('does not convert a legacy boolean or array container to an object', () => {
    for (const content of ['{"settings":{"locationService":true}}', '{"settings":[]}']) {
      expect(prepare(content, content)).toEqual({
        status: 'invalid',
        code: 'incompatible_container',
      });
    }
  });

  it('detects externally replaced and removed parents even when the original leaf was absent', () => {
    const initial = '{"settings":{"locationService":{}}}';
    for (const current of ['{"settings":{"locationService":false}}', '{}']) {
      expect(prepare(initial, current)).toEqual({ status: 'conflict', fields: [generalField] });
    }
  });

  it('rejects ambiguous edited paths while retaining unrelated duplicate keys unchanged', () => {
    const ambiguous =
      '{"settings":{"locationService":{"showAlternativeLocationButton":true,"showAlternativeLocationButton":false}}}';
    expect(prepare(ambiguous, ambiguous)).toEqual({ status: 'invalid', code: 'ambiguous_path' });
    const ambiguousParent = '{"settings":{},"settings":{"locationService":{}}}';
    expect(prepare(ambiguousParent, ambiguousParent)).toEqual({
      status: 'invalid',
      code: 'ambiguous_path',
    });
    const unrelated = base.slice(0, -1) + ',"future":1,"future":2}';
    const result = prepare(unrelated, unrelated);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('preparation_failed');
    expect(result.content).toContain('"future":1,"future":2');
  });

  it.each(['{', 'null', '[]', '{"settings":{},}', '{/* comment */}'])(
    'rejects unsupported raw documents without attempting cleanup: %s',
    (content) => {
      expect(prepare(content, base)).toEqual({ status: 'invalid', code: 'invalid_document' });
      expect(prepare(base, content)).toEqual({ status: 'invalid', code: 'invalid_document' });
    }
  );

  it.each(['instanceId', 'id', 'name', 'version'] as const)(
    'rejects a changed snapshot identity: %s',
    (key) => {
      const current = { ...snapshot(base), [key]: key === 'name' ? 'globalsettings' : 'other' };
      expect(
        reconcileAppConfigurationFields({
          scope: 'general',
          base: snapshot(base),
          current,
          changes: [{ field: generalField, operation: 'set', value: false }],
        })
      ).toEqual({ status: 'invalid', code: 'identity_mismatch' });
    }
  );

  it('supports an explicitly unversioned record without conflating it with an empty version', () => {
    const unversioned = { ...snapshot(base), version: null };
    expect(
      reconcileAppConfigurationFields({
        scope: 'general',
        base: unversioned,
        current: unversioned,
        changes: [],
      })
    ).toEqual({ status: 'ready', content: base, changedFields: [] });
    expect(
      reconcileAppConfigurationFields({
        scope: 'general',
        base: unversioned,
        current: { ...unversioned, version: '' },
        changes: [],
      })
    ).toEqual({ status: 'invalid', code: 'invalid_request' });
  });

  it('rejects an edit outside the host-selected field scope', () => {
    expect(prepare(base, base, [{ field: designField, operation: 'set', value: 4 }])).toEqual({
      status: 'invalid',
      code: 'field_not_owned',
    });
  });

  it('rejects arbitrary/prototype paths, duplicate changes and invalid field values', () => {
    const changes = [
      [{ field: '__proto__.polluted', operation: 'set', value: true }],
      [{ field: generalField, operation: 'set', value: 'false' }],
      [{ field: designField, operation: 'set', value: 0 }],
      [{ field: designField, operation: 'set', value: 1.5 }],
      [{ field: designField, operation: 'set', value: Infinity }],
      [{ field: generalField, operation: 'remove', value: null }],
      [
        { field: generalField, operation: 'set', value: false },
        { field: generalField, operation: 'remove' },
      ],
    ];
    for (const invalid of changes) {
      expect(
        reconcileAppConfigurationFields({
          scope: 'general',
          base: snapshot(base),
          current: snapshot(base),
          changes: invalid,
        })
      ).toEqual({ status: 'invalid', code: 'invalid_request' });
    }
  });
});
