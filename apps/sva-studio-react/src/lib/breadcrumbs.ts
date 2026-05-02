import { t } from '../i18n';

export type BreadcrumbItem = Readonly<{
  href?: string;
  label: string;
}>;

type BreadcrumbDescriptor = Readonly<{
  href?: string;
  label: string;
}>;

const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

const overviewBreadcrumb = (): BreadcrumbDescriptor => ({
  href: '/',
  label: t('shell.sidebar.overview'),
});

const breadcrumbRoutes: ReadonlyArray<
  Readonly<{
    build: () => ReadonlyArray<BreadcrumbDescriptor>;
    pattern: RegExp;
  }>
> = [
  {
    pattern: /^\/$/,
    build: () => [{ label: t('shell.sidebar.overview') }],
  },
  {
    pattern: /^\/account\/privacy$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/account', label: t('account.profile.title') },
      { label: t('account.privacy.title') },
    ],
  },
  {
    pattern: /^\/account$/,
    build: () => [overviewBreadcrumb(), { label: t('account.profile.title') }],
  },
  {
    pattern: /^\/admin\/content\/new$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/content', label: t('content.page.title') },
      { label: t('content.editor.createTitle') },
    ],
  },
  {
    pattern: /^\/admin\/content\/[^/]+$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/content', label: t('content.page.title') },
      { label: t('content.editor.editTitle') },
    ],
  },
  {
    pattern: /^\/admin\/content$/,
    build: () => [overviewBreadcrumb(), { label: t('content.page.title') }],
  },
  {
    pattern: /^\/admin\/news\/new$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/news', label: t('news.navigation.title') },
      { label: t('news.editor.createTitle') },
    ],
  },
  {
    pattern: /^\/plugins\/news\/new$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/news', label: t('news.navigation.title') },
      { label: t('news.editor.createTitle') },
    ],
  },
  {
    pattern: /^\/admin\/news\/[^/]+$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/news', label: t('news.navigation.title') },
      { label: t('news.editor.editTitle') },
    ],
  },
  {
    pattern: /^\/plugins\/news\/[^/]+$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/news', label: t('news.navigation.title') },
      { label: t('news.editor.editTitle') },
    ],
  },
  {
    pattern: /^\/admin\/news$/,
    build: () => [overviewBreadcrumb(), { label: t('news.navigation.title') }],
  },
  {
    pattern: /^\/plugins\/news$/,
    build: () => [overviewBreadcrumb(), { label: t('news.navigation.title') }],
  },
  {
    pattern: /^\/interfaces$/,
    build: () => [overviewBreadcrumb(), { label: t('interfaces.page.title') }],
  },
  {
    pattern: /^\/admin\/users\/[^/]+$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/users', label: t('shell.sidebar.userManagement') },
      { label: t('admin.users.edit.title') },
    ],
  },
  {
    pattern: /^\/admin\/users$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.userManagement') }],
  },
  {
    pattern: /^\/admin\/organizations$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.organizationManagement') }],
  },
  {
    pattern: /^\/admin\/roles\/[^/]+$/,
    build: () => [
      overviewBreadcrumb(),
      { href: '/admin/roles', label: t('shell.sidebar.roleManagement') },
      { label: t('admin.roles.editDialog.title') },
    ],
  },
  {
    pattern: /^\/admin\/roles$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.roleManagement') }],
  },
  {
    pattern: /^\/admin\/groups$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.groupManagement') }],
  },
  {
    pattern: /^\/admin\/legal-texts$/,
    build: () => [overviewBreadcrumb(), { label: t('admin.legalTexts.page.title') }],
  },
  {
    pattern: /^\/admin\/iam$/,
    build: () => [overviewBreadcrumb(), { label: t('admin.iam.page.title') }],
  },
  {
    pattern: /^\/admin\/api\/phase1-test$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.adminApiTest') }],
  },
  {
    pattern: /^\/media$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.media') }],
  },
  {
    pattern: /^\/categories$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.categories') }],
  },
  {
    pattern: /^\/app$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.app') }],
  },
  {
    pattern: /^\/modules$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.modules') }],
  },
  {
    pattern: /^\/monitoring$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.monitoring') }],
  },
  {
    pattern: /^\/help$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.help') }],
  },
  {
    pattern: /^\/support$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.support') }],
  },
  {
    pattern: /^\/license$/,
    build: () => [overviewBreadcrumb(), { label: t('shell.sidebar.license') }],
  },
];

export const resolveBreadcrumbItems = (pathname: string): ReadonlyArray<BreadcrumbItem> => {
  const normalizedPathname = normalizePathname(pathname);
  const routeMatch = breadcrumbRoutes.find((candidate) => candidate.pattern.test(normalizedPathname));

  if (!routeMatch) {
    return [{ label: t('shell.sidebar.overview') }];
  }

  const items = routeMatch.build();
  return items.map((item, index) => ({
    href: index === items.length - 1 ? undefined : item.href,
    label: item.label,
  }));
};
