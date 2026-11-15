import React from 'react';
import { Button, Input, StudioLoadingState, useStudioEditorSuspended } from '@sva/studio-ui-react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { ContentEditorLeaveBoundary } from '../../routing/content-editor-leave-boundary';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizationContext } from '../../hooks/use-organization-context';
import { useAppConfigurationPreview } from './-use-app-configuration-preview';
import {
  AppConfigurationFields,
  AppConfigurationChanges,
  AppConfigurationRecord,
} from './-app-configuration-preview-fields';
import { t } from '../../i18n';

const text = (key: string) => t(`interfaces.appConfiguration.${key}`);

/** The existing host boundary protects navigation, session recovery and voluntary context switches. */
export const AppConfigurationPreview = () => (
  <ContentEditorLeaveBoundary protectContextChanges>
    <ContextBoundPreview />
  </ContentEditorLeaveBoundary>
);

const ContextBoundPreview = () => {
  const auth = useAuth();
  const organization = useOrganizationContext();
  const identity =
    auth.user && !auth.isLoading && !organization.isLoading && !organization.isUpdating
      ? JSON.stringify([
          auth.user.id,
          auth.user.instanceId,
          organization.context?.activeOrganizationId,
        ])
      : undefined;
  const suspended = useStudioEditorSuspended();
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [confirmedIdentity, setConfirmedIdentity] = React.useState(identity);
  React.useEffect(() => {
    if (identity !== undefined && !hasUnsavedChanges && !suspended) setConfirmedIdentity(identity);
  }, [identity, hasUnsavedChanges, suspended]);
  // Keep the draft while context is unconfirmed; a confirmed different context gets a fresh editor.
  return (
    <PreviewEditor
      key={confirmedIdentity}
      contextReady={!suspended && identity !== undefined && identity === confirmedIdentity}
      onDirtyChange={setHasUnsavedChanges}
    />
  );
};

const PreviewEditor = ({
  contextReady,
  onDirtyChange,
}: Readonly<{ contextReady: boolean; onDirtyChange: (dirty: boolean) => void }>) => {
  const {
    version,
    setVersion,
    versionError,
    setVersionError,
    result,
    unavailableReason,
    source,
    draft,
    setDraft,
    setLinesTouched,
    dirty,
    invalidLines,
    discard,
    load,
    changes,
    pending,
    error,
    heading,
  } = useAppConfigurationPreview(contextReady);
  React.useLayoutEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  return (
    <section id="app-configuration-preview" aria-labelledby="app-configuration-heading">
      <Card>
        <CardHeader>
          <h2
            ref={heading}
            tabIndex={-1}
            id="app-configuration-heading"
            className="text-lg font-semibold"
          >
            {text('title')}
          </h2>

          <p className="text-sm text-muted-foreground">{text('intro')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert role="note">
            <AlertDescription>{text('notice')}</AlertDescription>
          </Alert>
          {!contextReady ? <StudioLoadingState>{text('loading')}</StudioLoadingState> : null}
          <fieldset
            disabled={!contextReady || pending}
            hidden={!contextReady}
            className="min-w-0 space-y-6 border-0 p-0"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void load();
              }}
              className="space-y-3"
            >
              <label className="block text-sm font-medium" htmlFor="app-configuration-version">
                {text('version')}
              </label>
              <Input
                id="app-configuration-version"
                value={version}
                maxLength={128}
                aria-describedby="app-configuration-version-help"
                aria-invalid={versionError || undefined}
                onChange={(event) => {
                  setVersion(event.target.value);
                  setVersionError(false);
                }}
              />
              <p id="app-configuration-version-help" className="text-sm text-muted-foreground">
                {text('versionHelp')}
              </p>
              {versionError ? (
                <p role="alert" className="text-sm text-destructive">
                  {text('versionError')}
                </p>
              ) : null}
              <Button type="submit">
                {text(pending ? 'loading' : result ? 'reload' : 'load')}
              </Button>
            </form>
            {error ? (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertDescription>{text('loadError')}</AlertDescription>
              </Alert>
            ) : null}
            {unavailableReason ? (
              <Alert>
                <AlertDescription>
                  {text(unavailableReason === 'not_resolved' ? 'notResolved' : 'invalidDocument')}
                </AlertDescription>
              </Alert>
            ) : null}
            {source ? (
              <>
                {source.fallback ? (
                  <Alert role="status">
                    <AlertDescription>{text('fallback')}</AlertDescription>
                  </Alert>
                ) : null}
                <AppConfigurationRecord source={source} />
                <AppConfigurationFields
                  source={source}
                  draft={draft}
                  invalidLines={invalidLines}
                  onChange={setDraft}
                  onLinesTouched={() => setLinesTouched(true)}
                />
                <AppConfigurationChanges
                  changes={changes}
                  invalidLines={invalidLines}
                  dirty={dirty}
                  discard={discard}
                />
              </>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>
    </section>
  );
};
