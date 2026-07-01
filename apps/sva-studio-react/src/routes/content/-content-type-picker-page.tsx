import { BarChart3, CalendarDays, FileText, MapPin, Shapes } from 'lucide-react';
import { StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';

import { useContentAccess } from '../../hooks/use-content-access';
import { t } from '../../i18n';
import { studioContentTypes } from '../../lib/plugins';
import { filterCreatableStudioContentTypes } from '../../lib/studio-content-types';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

const contentTypePresentationByNamespace = {
  news: {
    icon: FileText,
    descriptionKey: 'content.typePicker.typeDescriptions.news',
  },
  events: {
    icon: CalendarDays,
    descriptionKey: 'content.typePicker.typeDescriptions.events',
  },
  poi: {
    icon: MapPin,
    descriptionKey: 'content.typePicker.typeDescriptions.poi',
  },
  surveys: {
    icon: BarChart3,
    descriptionKey: 'content.typePicker.typeDescriptions.surveys',
  },
} as const satisfies Record<string, { icon: LucideIcon; descriptionKey: string }>;

type KnownContentTypeNamespace = keyof typeof contentTypePresentationByNamespace;

const resolveContentTypeNamespace = (contentType: string): string => contentType.split('.', 1)[0] ?? contentType;

const isKnownContentTypeNamespace = (value: string): value is KnownContentTypeNamespace =>
  value in contentTypePresentationByNamespace;

const resolveTypePresentation = (contentType: string): { icon: LucideIcon; description: string } => {
  const namespace = resolveContentTypeNamespace(contentType);
  if (isKnownContentTypeNamespace(namespace)) {
    const knownPresentation = contentTypePresentationByNamespace[namespace];
    return {
      icon: knownPresentation.icon,
      description: t(knownPresentation.descriptionKey),
    };
  }

  return {
    icon: Shapes,
    description: t('content.typePicker.fallbackDescription', { type: contentType }),
  };
};

const resolveTypeDescription = (contentType: string): string => resolveTypePresentation(contentType).description;

export const ContentTypePickerPage = () => {
  const contentAccessApi = useContentAccess();
  const creatableContentTypes = filterCreatableStudioContentTypes(studioContentTypes, contentAccessApi.permissionActions);

  return (
    <section className="space-y-6" aria-busy={contentAccessApi.isLoading}>
      <StudioOverviewPageTemplate
        title={t('content.typePicker.title')}
        description={t('content.typePicker.subtitle')}
      >
        {contentAccessApi.access ? (
          <p className="text-sm text-muted-foreground">{t('content.typePicker.help')}</p>
        ) : null}
      </StudioOverviewPageTemplate>

      {creatableContentTypes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('content.typePicker.empty.title')}</CardTitle>
            <CardDescription>{t('content.typePicker.empty.body')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {creatableContentTypes.map((definition) => (
            <Card key={definition.contentType} className="border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <Link
                to={definition.createPath}
                aria-label={definition.displayName}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {(() => {
                      const Icon = resolveTypePresentation(definition.contentType).icon;
                      return <Icon className="h-6 w-6" aria-hidden="true" />;
                    })()}
                  </div>
                  <div className="space-y-2">
                    <CardTitle>{definition.displayName}</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      {resolveTypeDescription(definition.contentType)}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
