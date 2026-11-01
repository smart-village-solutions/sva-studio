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
      <ol className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 ? (
                <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1} aria-hidden="true" />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="animate-breadcrumb-slide min-w-0 break-words transition-colors duration-200 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={
                    isLast
                      ? 'min-w-0 break-words font-medium text-foreground'
                      : 'min-w-0 break-words'
                  }
                >
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
