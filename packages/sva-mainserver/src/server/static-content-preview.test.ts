import { describe, expect, it } from 'vitest';
import { projectAppConfigurationPreview as project } from './static-content-preview.js';
const file = {
  id: 17,
  name: 'globalSettings',
  dataType: 'json',
  version: null,
  content:
    '{"settings":{"locationService":{"showAlternativeLocationButton":false}},"appDesignSystem":{"serviceTiles":{"numberOfLines":2}},"secret":"private","foreign":90071992547409931234}',
};
describe('App configuration preview projection', () => {
  it('projects only the two fields and preserves false', () => {
    const result = project(file, 'tenant-a', { version: null });
    expect(result).toEqual({
      status: 'loaded',
      instanceId: 'tenant-a',
      requestedVersion: null,
      record: { id: '17', name: 'globalSettings', version: null },
      fallback: false,
      fields: {
        alternativeLocation: { state: 'value', value: false },
        tileTitleLines: { state: 'value', value: 2 },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('foreign');
  });
  it('shows the actual fallback instead of claiming the requested version', () => {
    expect(
      project({ ...file, version: '4.0.0', content: {} }, 'tenant-a', { version: '5.0.0' })
    ).toMatchObject({
      status: 'loaded',
      fallback: true,
      record: { version: '4.0.0' },
      requestedVersion: '5.0.0',
    });
  });
  it('accepts the existing empty-string marker for unversioned records', () => {
    expect(project({ ...file, version: '' }, 'tenant-a', { version: null })).toMatchObject({
      status: 'loaded',
      record: { version: null },
      fallback: false,
      fields: { alternativeLocation: { state: 'value', value: false } },
    });
  });
  it('loads a decoded object from an unversioned fallback to a versioned request', () => {
    expect(
      project({ ...file, content: JSON.parse(file.content) }, 'tenant-a', { version: '5.0.0' })
    ).toMatchObject({
      status: 'loaded',
      record: { version: null },
      fallback: true,
      fields: { alternativeLocation: { state: 'value', value: false } },
    });
  });
  it('does not reparse a decoded JSON string from an unversioned fallback', () => {
    expect(project({ ...file, content: '{}' }, 'tenant-a', { version: '5.0.0' })).toEqual({
      status: 'unavailable',
      reason: 'invalid_document',
    });
  });
  it.each([{ content: {} }, { content: { settings: {} } }])(
    'distinguishes absent fields',
    ({ content }) => {
      expect(project({ ...file, content }, 'tenant-a', { version: '5.0.0' })).toMatchObject({
        fields: { alternativeLocation: { state: 'missing' }, tileTitleLines: { state: 'missing' } },
      });
    }
  );
  it.each([{ container: false }, { container: null }, { container: [] }, { container: 3 }])(
    'does not replace incompatible containers: %j',
    ({ container }) => {
      expect(
        project({ ...file, content: { settings: { locationService: container } } }, 'tenant-a', {
          version: '5.0.0',
        })
      ).toMatchObject({ fields: { alternativeLocation: { state: 'unsupported' } } });
    }
  );
  it('rejects non-safe and wrong field values', () => {
    expect(
      project(
        {
          ...file,
          content: {
            settings: { locationService: { showAlternativeLocationButton: 'false' } },
            appDesignSystem: { serviceTiles: { numberOfLines: 9007199254740992 } },
          },
        },
        'tenant-a',
        { version: '5.0.0' }
      )
    ).toMatchObject({
      fields: {
        alternativeLocation: { state: 'unsupported' },
        tileTitleLines: { state: 'unsupported' },
      },
    });
  });
  it.each([
    { content: '{}' },
    { content: 'invalid' },
    { content: null },
    { content: [] },
    { content: 42 },
  ])('does not guess versioned strings or invalid documents: %j', ({ content }) => {
    expect(
      project({ ...file, version: '5.0.0', content }, 'tenant-a', { version: '5.0.0' })
    ).toEqual({ status: 'unavailable', reason: 'invalid_document' });
  });
  it('does not treat a resolver sentinel as an empty configuration', () => {
    expect(project({ name: 'not found', content: {} }, 'tenant-a', { version: null })).toEqual({
      status: 'unavailable',
      reason: 'not_resolved',
    });
  });
  it('rejects malformed identity metadata without returning its content', () => {
    expect(() => project({ ...file, name: 'other' }, 'tenant-a', { version: null })).toThrow(
      'app_configuration_metadata_invalid'
    );
  });
  it('validates versions', () => {
    expect(() => project(file, 'tenant-a', { version: 'invalid version' })).toThrow(
      'app_configuration_selection_invalid'
    );
  });
});
