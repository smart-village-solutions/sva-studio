import { t } from '../i18n';
import { breadcrumbRoutes } from './breadcrumbs.routes';

export type BreadcrumbItem = Readonly<{
  href?: string;
  label: string;
}>;

const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

export const resolveBreadcrumbItems = (pathname: string): ReadonlyArray<BreadcrumbItem> => {
  const normalizedPathname = normalizePathname(pathname);
  const routeMatch = breadcrumbRoutes.find((candidate) =>
    candidate.pattern.test(normalizedPathname)
  );

  if (!routeMatch) {
    return [{ label: t('shell.sidebar.overview') }];
  }

  const items = routeMatch.build();
  return items.map((item, index) => ({
    href: index === items.length - 1 ? undefined : item.href,
    label: item.label,
  }));
};
