import type {
  PluginServerExecutionHandler,
  PluginServerHandlerRegistryEntry,
} from '@sva/plugin-sdk';

export const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (trimmed === '/') return trimmed;
  return trimmed.replace(/\/+$/, '');
};

const pathSegments = (path: string): readonly string[] => path.split('/').filter(Boolean);

const endpointShape = (path: string): string =>
  '/' +
  pathSegments(path)
    .map((segment) => (segment.startsWith('$') ? '$' : segment))
    .join('/');

export const staticSegmentCount = (path: string): number =>
  pathSegments(path).filter((segment) => !segment.startsWith('$')).length;

const pathsOverlap = (left: string, right: string): boolean => {
  const leftSegments = pathSegments(left);
  const rightSegments = pathSegments(right);
  return (
    leftSegments.length === rightSegments.length &&
    leftSegments.every((segment, index) => {
      const counterpart = rightSegments[index];
      return segment === counterpart || segment.startsWith('$') || counterpart?.startsWith('$');
    })
  );
};

export const matchPath = (
  template: string,
  path: string
): Readonly<Record<string, string>> | null => {
  const templateSegments = pathSegments(template);
  const requestSegments = pathSegments(path);
  if (templateSegments.length !== requestSegments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < templateSegments.length; index += 1) {
    const expected = templateSegments[index];
    const actual = requestSegments[index];
    if (!expected || !actual) return null;
    if (expected.startsWith('$')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
};

export const isDomainHandler = (descriptor: PluginServerHandlerRegistryEntry): boolean =>
  descriptor.path.startsWith(`/api/v1/${descriptor.ownerPluginId}/`);

export const assertPluginServerHandlerCoverage = (input: {
  readonly descriptors: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
  readonly handlers: Readonly<Record<string, PluginServerExecutionHandler>>;
  readonly reservedPaths?: readonly string[];
}): void => {
  const endpoints = new Map<string, string>();
  const examined: PluginServerHandlerRegistryEntry[] = [];
  for (const descriptor of input.descriptors.values()) {
    const reservedPath = input.reservedPaths?.find((path) => pathsOverlap(path, descriptor.path));
    if (reservedPath) {
      throw new Error(
        `plugin_server_endpoint_conflicts_with_host:${descriptor.id}:${reservedPath}`
      );
    }
    const endpointKey = `${descriptor.method} ${endpointShape(descriptor.path)}`;
    const existingHandlerId = endpoints.get(endpointKey);
    if (existingHandlerId) {
      throw new Error(
        `duplicate_plugin_server_endpoint:${endpointKey}:${existingHandlerId}:${descriptor.id}`
      );
    }
    const ambiguous = examined.find(
      (entry) =>
        entry.method === descriptor.method &&
        staticSegmentCount(entry.path) === staticSegmentCount(descriptor.path) &&
        pathsOverlap(entry.path, descriptor.path)
    );
    if (ambiguous) {
      throw new Error(
        `ambiguous_plugin_server_endpoint:${descriptor.method}:${ambiguous.id}:${descriptor.id}`
      );
    }
    endpoints.set(endpointKey, descriptor.id);
    examined.push(descriptor);
  }
  const declared = [...input.descriptors.keys()].sort((left, right) => left.localeCompare(right));
  const registered = Object.keys(input.handlers).sort((left, right) => left.localeCompare(right));
  const missing = declared.filter((handlerId) => !registered.includes(handlerId));
  if (missing.length > 0) {
    throw new Error(`missing_plugin_server_handlers:${missing.join(',')}`);
  }
  const unknown = registered.filter((handlerId) => !declared.includes(handlerId));
  if (unknown.length > 0) {
    throw new Error(`unknown_plugin_server_handlers:${unknown.join(',')}`);
  }
};
