export type GenericItemsDetailTabId = 'basis' | 'content' | 'settings' | 'history';

export const genericItemsDetailTabIds = ['basis', 'content', 'settings', 'history'] as const satisfies readonly GenericItemsDetailTabId[];
