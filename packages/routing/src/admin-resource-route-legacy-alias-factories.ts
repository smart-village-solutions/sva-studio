import type { AdminResourceDefinition } from '@sva/plugin-sdk';
import { createRoute, redirect, type RootRoute } from '@tanstack/react-router';

import {
  LEGACY_CONTENT_ALIAS_PREFIX,
  normalizeLegacyContentHref,
  readBeforeLoadHref,
  resolveCanonicalContentAdminRoutePath,
} from './admin-resource-route-aliases.js';
import { toAdminRoutePath } from './admin-resource-route-paths.js';
import type { AppRouteFactory } from './app.routes.shared.js';

const normalizeAliasHref = (href: string, sourcePrefix: string, targetPrefix: string): string => {
  if (sourcePrefix === LEGACY_CONTENT_ALIAS_PREFIX) {
    return normalizeLegacyContentHref(href, targetPrefix);
  }

  if (href === sourcePrefix || href.startsWith(`${sourcePrefix}?`)) {
    return href.replace(sourcePrefix, targetPrefix);
  }

  const createSourcePrefix = `${sourcePrefix}/new`;
  const createTargetPrefix = `${targetPrefix}/new`;
  if (href === createSourcePrefix || href.startsWith(`${createSourcePrefix}?`)) {
    return href.replace(createSourcePrefix, createTargetPrefix);
  }

  if (href.startsWith(`${sourcePrefix}/`)) {
    return href.replace(`${sourcePrefix}/`, `${targetPrefix}/`);
  }

  return targetPrefix;
};

export const createLegacyContentAliasFactories = (
  resources: readonly AdminResourceDefinition[] = []
): readonly AppRouteFactory[] => {
  const canonicalContentPath = resolveCanonicalContentAdminRoutePath(resources);
  const aliasMappings = [
    {
      sourcePrefix: LEGACY_CONTENT_ALIAS_PREFIX,
      targetPrefix: canonicalContentPath,
    },
    ...resources
      .filter((resource) => resource.guard === 'content')
      .map((resource) => ({
        sourcePrefix: `/plugins/${resource.basePath}`,
        targetPrefix: toAdminRoutePath(resource.basePath),
      })),
  ] as const;

  return aliasMappings.flatMap(({ sourcePrefix, targetPrefix }) =>
    [sourcePrefix, `${sourcePrefix}/new`, `${sourcePrefix}/$contentId`].map((path) => (rootRoute: RootRoute) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        beforeLoad: (options) => {
          const href = readBeforeLoadHref(options);
          const normalizedHref = normalizeAliasHref(href, sourcePrefix, targetPrefix);
          throw redirect({ href: normalizedHref });
        },
        component: () => null,
      })
    )
  );
};
