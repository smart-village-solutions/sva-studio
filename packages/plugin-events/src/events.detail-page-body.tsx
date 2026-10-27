import { Link } from '@tanstack/react-router';
import {
  Button,
  MainserverDeviationSummary,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioFormSummary,
  StudioPersistentFormError,
  StudioMediaReferenceRetryAction,
  StudioPersistentActionResult,
} from '@sva/studio-ui-react';
import { EventsDetailDeleteDialog } from './events.detail-delete.js';
import { EventsDetailEditorTabs } from './events.detail-editor-tabs.js';
import { EventsDetailMediaPicker } from './events.detail-media-picker.js';
import type { EventsDetailPageViewProps } from './events.detail-page-view.js';
const EventsDetailStatus = ({
  deletion,
  methods,
  status,
  pt,
  actingPrincipalType,
  setActingPrincipalType,
  mode,
  principalControl,
  deviations,
  deviationFieldLabels,
  media,
  setStatus,
}: EventsDetailPageViewProps) => (
  <>
    {deletion.navigationFailed ? (
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
    {status ? (
      status.kind === 'error' ? (
        <StudioPersistentFormError
          message={status.text}
          requestId={status.requestId}
          requestIdLabel={status.requestId ? pt('messages.requestReference') : undefined}
          copyRequestIdLabel={status.requestId ? pt('messages.copyRequestReference') : undefined}
          requestIdCopiedLabel={
            status.requestId ? pt('messages.requestReferenceCopied') : undefined
          }
          requestIdCopyFailedLabel={
            status.requestId ? pt('messages.requestReferenceCopyFailed') : undefined
          }
        />
      ) : (
        <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary>
      )
    ) : null}
    {mode === 'create' && media.leaveGuard.createdContentId ? (
      <StudioFormSummary kind="success">
        {!media.mediaReferenceSync.hasPendingRetry &&
        (methods.formState.isDirty || media.mediaDirty) ? (
          <span className="block">{pt('messages.unsavedAfterCreate')}</span>
        ) : null}
        <Link to="/admin/events/$id" params={{ id: media.leaveGuard.createdContentId }}>
          {pt('actions.openSavedContent')}
        </Link>
      </StudioFormSummary>
    ) : null}
    <div
      className={
        mode === 'create'
          ? 'has-[select]:rounded-2xl has-[select]:border has-[select]:border-border/60 has-[select]:bg-card has-[select]:p-5'
          : undefined
      }
    >
      <MainserverPrincipalControl
        fixedLabel={mode === 'create' ? pt('create.responsible') : undefined}
        id="events-acting-principal"
        label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
        description={pt('principal.description')}
        value={actingPrincipalType}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: actingPrincipalType,
          label: pt(`principal.${actingPrincipalType}`),
        })}
        onChange={setActingPrincipalType}
      />
    </div>
    <MainserverDeviationSummary
      deviations={deviations}
      title={pt('messages.degradedDataWarning')}
      fieldLabel={(field) =>
        pt('messages.degradedField', {
          field: deviationFieldLabels[field] ?? field,
        })
      }
    />
    <StudioMediaReferenceRetryAction
      controller={media.mediaReferenceSync}
      label={pt('actions.retryMediaReferences')}
      onSuccess={() => {
        media.leaveGuard.acknowledgeReferenceRetry();
        setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') });
      }}
      onFailure={() =>
        setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') })
      }
    />
  </>
);

function EventsEditorFields(props: EventsDetailPageViewProps) {
  const {
    pt,
    media,
    canUploadMedia,
    mode,
    contentId,
    tabs,
    activeTab,
    handleTabChange,
    warmTab,
    visitedTabs,
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    loadedItem,
    canSelectMedia,
    mediaReferencesReady,
    saveFeedback,
  } = props;
  return (
    <EventsDetailEditorTabs
      pt={pt}
      mode={mode}
      contentId={contentId}
      tabs={tabs}
      activeTab={activeTab}
      handleTabChange={handleTabChange}
      warmTab={warmTab}
      visitedTabs={visitedTabs}
      categoryOptions={categoryOptions}
      categoryOptionsError={categoryOptionsError}
      categoryOptionsLoading={categoryOptionsLoading}
      loadedItem={loadedItem}
      mediaUsages={media.mediaUsages}
      addManualMedia={media.addManualMedia}
      onChangeMediaUsages={(usages) => {
        media.setMediaUsages(usages);
        media.setRequiresReferenceSync(
          (current) => current || usages.some((usage) => Boolean(usage.assetId))
        );
      }}
      canSelectMedia={canSelectMedia}
      canUploadMedia={canUploadMedia}
      mediaEditingDisabled={!mediaReferencesReady || saveFeedback.status === 'saving'}
      onOpenMediaPicker={(pickerMode) =>
        pickerMode === 'upload' ? media.mediaPicker.openUpload() : media.mediaPicker.openLibrary()
      }
    />
  );
}

export function EventsDetailPageBody(props: EventsDetailPageViewProps) {
  const { methods, pt, deletion, media, canUploadMedia, canUpdateMedia, navigate, formId, submit } =
    props;
  return (
    <>
      <EventsDetailDeleteDialog
        deletion={deletion}
        title={methods.getValues('title') || pt('detail.editTitle')}
        pt={pt}
      />
      <EventsDetailMediaPicker
        media={media}
        canUploadMedia={canUploadMedia}
        canUpdateMedia={canUpdateMedia}
        navigate={navigate}
      />
      <form
        onInvalidCapture={(event) =>
          event.target instanceof HTMLElement &&
          event.target.closest('details')?.setAttribute('open', '')
        }
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-5"
      >
        <EventsDetailStatus {...props} />
        <EventsEditorFields {...props} />
      </form>
    </>
  );
}
