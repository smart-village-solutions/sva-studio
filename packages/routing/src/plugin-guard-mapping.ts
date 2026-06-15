import type { PluginRouteGuard } from '@sva/plugin-sdk';

export const mapPluginGuardToAccountGuard = (
  guard?: PluginRouteGuard
): 'content' | 'contentCreate' | 'contentDetail' | null => {
  switch (guard) {
    case 'content.read':
      return 'content';
    case 'content.create':
      return 'contentCreate';
    case 'content.updateMetadata':
    case 'content.updatePayload':
    case 'content.changeStatus':
    case 'content.publish':
    case 'content.archive':
    case 'content.restore':
    case 'content.readHistory':
    case 'content.manageRevisions':
    case 'content.delete':
      return 'contentDetail';
    default:
      return null;
  }
};
