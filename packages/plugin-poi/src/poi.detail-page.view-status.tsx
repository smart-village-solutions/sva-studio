import { Link } from '@tanstack/react-router';
import {
  Button,
  StudioPersistentActionResult,
  StudioFormSummary,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  MainserverDeviationSummary,
  StudioMediaReferenceRetryAction,
} from '@sva/studio-ui-react';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';

export function PoiFormStatus({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const { mode, pt, media } = view;
  const { mediaReferenceSync } = media;
  return (
    <>
      {view.deleteNavigationFailed ? (
        <StudioPersistentActionResult
          kind="success"
          title={pt('messages.deleteSuccess')}
          description={pt('messages.deleteNavigationError')}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/content">{pt('actions.back')}</Link>
            </Button>
          }
        />
      ) : null}
      {view.status ? (
        <StudioFormSummary kind={view.status.kind}>{view.status.text}</StudioFormSummary>
      ) : null}
      {mode === 'create' && media.leaveGuard.createdContentId ? (
        <StudioFormSummary kind="success">
          {!mediaReferenceSync.hasPendingRetry &&
          (view.methods.formState.isDirty || media.mediaDirty) ? (
            <span className="block">{pt('messages.unsavedAfterCreate')}</span>
          ) : null}
          <Link to="/admin/poi/$id" params={{ id: media.leaveGuard.createdContentId }}>
            {pt('actions.openSavedContent')}
          </Link>
        </StudioFormSummary>
      ) : null}
      <div
        className={
          mode === 'create' && view.principalControl?.kind === 'selectable'
            ? 'space-y-4 rounded-lg border border-border-subtle bg-card p-4 sm:p-6'
            : undefined
        }
      >
        <MainserverPrincipalControl
          fixedLabel={mode === 'create' ? pt('create.responsible') : undefined}
          id="poi-acting-principal"
          label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
          description={pt('principal.description')}
          value={view.actingPrincipalType}
          options={resolveMainserverPrincipalOptions(view.principalControl, {
            value: view.actingPrincipalType,
            label: pt(`principal.${view.actingPrincipalType}`),
          })}
          onChange={view.setActingPrincipalType}
          readinessByPrincipal={view.principalControl?.readinessByPrincipal}
          readinessMessage={view.principalControl?.readinessMessage}
        />
      </div>
      <MainserverDeviationSummary
        deviations={view.deviations}
        title={pt('messages.degradedDataWarning')}
        fieldLabel={(field) =>
          pt('messages.degradedField', { field: view.deviationFieldLabels[field] ?? field })
        }
      />
      <StudioMediaReferenceRetryAction
        controller={mediaReferenceSync}
        label={pt('messages.mediaReferenceRetry')}
        onSuccess={() => {
          media.leaveGuard.acknowledgeReferenceRetry();
          view.setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') });
        }}
        onFailure={() =>
          view.setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') })
        }
      />
    </>
  );
}
