import { Link } from '@tanstack/react-router';
import { CalendarDays, ImageUp, Newspaper, Users, type LucideIcon } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { t } from '../i18n';
import {
  hasPlatformInstanceAdminAccess,
  hasUserAdminAccess,
  isIamAdminEnabled,
} from '../lib/iam-admin-access';
import { studioContentTypes } from '../lib/plugins';
import type { useAuth } from '../providers/auth-provider';

type HomeActionCard = {
  readonly description: string;
  readonly icon: LucideIcon;
  readonly id: string;
  readonly title: string;
  readonly to: string;
};

const findCreatePath = (requiredAction: string) =>
  studioContentTypes.find((definition) => definition.requiredCreateAction === requiredAction)
    ?.createPath;

const resolveHomeActionCards = (
  user: ReturnType<typeof useAuth>['user'],
  permissionActions: readonly string[]
): HomeActionCard[] => {
  const cards: HomeActionCard[] = [];
  const accessUser = user ? { ...user, permissionActions } : null;
  const hasModulePermission = (moduleId: string, action: string) =>
    user?.assignedModules?.includes(moduleId) === true && permissionActions.includes(action);
  const addContentCard = (id: string, moduleId: string, action: string, icon: LucideIcon) => {
    const to = findCreatePath(action);
    if (to && hasModulePermission(moduleId, action)) {
      cards.push({
        id,
        to,
        title: t(`home.cards.${id}.title`),
        description: t(`home.cards.${id}.description`),
        icon,
      });
    }
  };

  addContentCard('news', 'news', 'news.create', Newspaper);
  addContentCard('events', 'events', 'events.create', CalendarDays);

  if (hasModulePermission('media', 'media.create')) {
    cards.push({
      id: 'media',
      to: '/admin/media/new',
      title: t('home.cards.media.title'),
      description: t('home.cards.media.description'),
      icon: ImageUp,
    });
  }

  if (
    isIamAdminEnabled() &&
    (hasUserAdminAccess(accessUser) || hasPlatformInstanceAdminAccess(accessUser))
  ) {
    cards.push({
      id: 'users',
      to: '/admin/users',
      title: t('home.cards.users.title'),
      description: t('home.cards.users.description'),
      icon: Users,
    });
  }

  return cards;
};

const resolveDesktopGridClass = (cardCount: number) => {
  if (cardCount >= 4) return 'lg:grid-cols-4';
  if (cardCount === 3) return 'lg:grid-cols-3';
  if (cardCount === 2) return 'lg:grid-cols-2';
  return 'lg:grid-cols-1';
};

export const HomeActionCards = ({
  permissionActions,
  user,
}: {
  readonly permissionActions: readonly string[];
  readonly user: ReturnType<typeof useAuth>['user'];
}) => {
  const cards = resolveHomeActionCards(user, permissionActions);
  const mediumGridClass = cards.length >= 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

  if (cards.length === 0) return null;

  return (
    <div className={`grid gap-4 ${mediumGridClass} ${resolveDesktopGridClass(cards.length)}`}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.id}
            data-studio-workbench-module={card.id}
            className="h-full border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <Link
              to={card.to}
              className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CardHeader className="h-full space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">
                    {card.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Link>
          </Card>
        );
      })}
    </div>
  );
};
