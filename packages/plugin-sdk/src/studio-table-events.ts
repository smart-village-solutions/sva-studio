export const STUDIO_TABLE_DATA_CHANGED = 'studio:table-data-changed';

export function notifyStudioTableDataChanged(resource: string, deleted = false) {
  globalThis.window?.dispatchEvent(
    new CustomEvent(STUDIO_TABLE_DATA_CHANGED, { detail: { resource, deleted } })
  );
}

export function publishMainserverTableMutation(url: string, method: string) {
  const resource = /\/api\/v1\/mainserver\/([\w-]+)(?:\/|\?|$)/.exec(url)?.[1];
  if (resource && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    notifyStudioTableDataChanged(resource, method === 'DELETE');
  }
}
