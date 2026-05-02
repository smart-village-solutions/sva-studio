import type { AdminResourceDefinition } from '@sva/plugin-sdk';

import { toAdminRoutePath } from './admin-resource-route-paths.js';

export const LEGACY_CONTENT_ALIAS_PREFIX = '/content';

export const coreContentAdminResource = {
  resourceId: 'content',
  basePath: 'content',
  titleKey: 'content.page.title',
  guard: 'content',
  views: {
    list: { bindingKey: 'content' },
    create: { bindingKey: 'contentCreate' },
    detail: { bindingKey: 'contentDetail' },
  },
} as const satisfies AdminResourceDefinition;

export const withCoreContentAdminResource = (
  resources: readonly AdminResourceDefinition[]
): readonly AdminResourceDefinition[] => {
  const containsCoreContent = resources.some(
    (resource) =>
      resource.resourceId === coreContentAdminResource.resourceId ||
      resource.basePath === coreContentAdminResource.basePath
  );
  if (containsCoreContent) {
    return resources;
  }
  return [coreContentAdminResource, ...resources];
};

export const resolveCanonicalContentAdminRoutePath = (
  resources: readonly AdminResourceDefinition[]
): string => {
  const contentResource = withCoreContentAdminResource(resources).find(
    (resource) => resource.resourceId === coreContentAdminResource.resourceId
  );
  return toAdminRoutePath(contentResource?.basePath ?? coreContentAdminResource.basePath);
};

export const readBeforeLoadHref = (options: unknown): string => {
  const candidate = options as {
    href?: unknown;
    location?: { href?: unknown };
  };

  if (typeof candidate.location?.href === 'string' && candidate.location.href.length > 0) {
    return candidate.location.href;
  }
  if (typeof candidate.href === 'string' && candidate.href.length > 0) {
    return candidate.href;
  }

  return LEGACY_CONTENT_ALIAS_PREFIX;
};

export const normalizeLegacyAdminResourceHref = (input: {
  readonly href: string;
  readonly aliasPrefix: string;
  readonly canonicalPath: string;
}): string => {
  if (input.href === input.aliasPrefix || input.href.startsWith(`${input.aliasPrefix}?`)) {
    return input.href.replace(input.aliasPrefix, input.canonicalPath);
  }
  if (input.href === `${input.aliasPrefix}/new` || input.href.startsWith(`${input.aliasPrefix}/new?`)) {
    return input.href.replace(`${input.aliasPrefix}/new`, `${input.canonicalPath}/new`);
  }
  if (input.href.startsWith(`${input.aliasPrefix}/`)) {
    return input.href.replace(`${input.aliasPrefix}/`, `${input.canonicalPath}/`);
  }

  return input.canonicalPath;
};

export const normalizeLegacyContentHref = (href: string, canonicalContentPath: string): string =>
  normalizeLegacyAdminResourceHref({
    href,
    aliasPrefix: LEGACY_CONTENT_ALIAS_PREFIX,
    canonicalPath: canonicalContentPath,
  });
