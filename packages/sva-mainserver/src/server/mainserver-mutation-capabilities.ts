const CONFIRMED_CAPABILITIES_ENV = 'SVA_MAINSERVER_CONFIRMED_CAPABILITIES';

const defaultCapabilities = new Set([
  'cockpit-cards.create',
  'cockpit-cards.delete',
  'cockpit-cards.update',
  'events.create',
  'events.delete',
  'events.update',
  'faq.create',
  'faq.delete',
  'faq.update',
  'generic-items.create',
  'generic-items.delete',
  'generic-items.update',
  'news.create',
  'news.delete',
  'news.update',
  'poi.create',
  'poi.delete',
  'poi.update',
  'projects.create',
  'projects.delete',
  'projects.update',
  'surveys.create',
]);

const readConfirmedCapabilities = (): ReadonlySet<string> => {
  const configured = (process.env[CONFIRMED_CAPABILITIES_ENV] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[a-z][a-z0-9-]{1,30}\.[A-Za-z][A-Za-z0-9-]*$/.test(value));
  return new Set([...defaultCapabilities, ...configured]);
};

export const isMainserverMutationCapabilityEnabled = (action: string): boolean =>
  readConfirmedCapabilities().has(action);

export const getMainserverMutationCapabilityEnvironmentName = (): string =>
  CONFIRMED_CAPABILITIES_ENV;
