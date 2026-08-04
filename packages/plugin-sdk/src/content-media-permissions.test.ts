import { describe, expect, it } from 'vitest';
import { resolveContentMediaCapabilities } from './content-media-permissions.js';

describe('content media permissions', () => {
  it.each([
    [false, ['media.read', 'media.create', 'media.update', 'media.reference.manage'], { canSelect: false, canUpload: false, canEditAssetMetadata: false }],
    [true, ['media.read'], { canSelect: false, canUpload: false, canEditAssetMetadata: false }],
    [true, ['media.read', 'media.reference.manage'], { canSelect: true, canUpload: false, canEditAssetMetadata: false }],
    [true, ['media.read', 'media.reference.manage', 'media.create'], { canSelect: true, canUpload: true, canEditAssetMetadata: false }],
    [true, ['media.read', 'media.reference.manage', 'media.update'], { canSelect: true, canUpload: false, canEditAssetMetadata: true }],
  ] as const)('derives capabilities for content=%s and actions=%j', (canEditContent, permissionActions, expected) => {
    expect(resolveContentMediaCapabilities({ canEditContent, permissionActions })).toEqual(expected);
  });
});
