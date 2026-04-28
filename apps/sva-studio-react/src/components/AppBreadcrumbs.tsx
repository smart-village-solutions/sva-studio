import { ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { t } from '../i18n';
import { resolveBreadcrumbItems } from '../lib/breadcrumbs';

type AppBreadcrumbsProps = Readonly<{
  pathname: string;
}>;

export function AppBreadcrumbs({ pathname }: AppBreadcrumbsProps) {
  const items = resolveBreadcrumbItems(pathname);

  return (
    <nav aria-label={t('shell.breadcrumbs.ariaLabel')}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
              {item.href && !isLast ? (
                <Link to={item.href} className="animate-breadcrumb-slide transition-all duration-200 hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'font-medium text-foreground' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
