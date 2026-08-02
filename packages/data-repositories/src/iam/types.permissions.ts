import type { CorePermissionKey } from '@sva/core';

export type PermissionKey =
  | CorePermissionKey
  | 'media.read'
  | 'media.create'
  | 'media.update'
  | 'media.reference.manage'
  | 'media.delete'
  | 'media.deliver.protected';
