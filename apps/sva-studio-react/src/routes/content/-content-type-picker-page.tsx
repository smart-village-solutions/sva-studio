import { StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';

import { useContentAccess } from '../../hooks/use-content-access';
import { t } from '../../i18n';
import { studioContentTypes } from '../../lib/plugins';
import { filterCreatableStudioContentTypes } from '../../lib/studio-content-types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';

const resolveTypeDescription = (description: string | undefined, displayName: string): string =>
  description && description.trim().length > 0 ? description : t('content.typePicker.fallbackDescription', { type: displayName });

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
            <Card key={definition.contentType} className="border-border/80">
              <CardHeader className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {definition.displayName.slice(0, 1)}
                </div>
                <div className="space-y-1">
                  <CardTitle>{definition.displayName}</CardTitle>
                  <CardDescription>{resolveTypeDescription(definition.description, definition.displayName)}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{definition.contentType}</p>
              </CardContent>
              <CardFooter>
                <Link
                  to={definition.createPath}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/90"
                >
                  {t('content.typePicker.openCreate')}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
