import { Link } from '@tanstack/react-router';
import {
  Button,
  MainserverDeviationSummary,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioFormSummary,
  StudioMediaReferenceRetryAction,
  StudioPersistentActionResult,
} from '@sva/studio-ui-react';
import { EventsDetailDeleteDialog } from './events.detail-delete.js';
import { EventsDetailEditorTabs } from './events.detail-editor-tabs.js';
import { EventsDetailMediaPicker } from './events.detail-media-picker.js';
import type { EventsDetailPageViewProps } from './events.detail-page-view.js';

const EventsDetailStatus = ({
  deletion,
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
    {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
    <MainserverPrincipalControl
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
      onSuccess={() =>
        setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') })
      }
      onFailure={() =>
        setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') })
      }
    />
  </>
);

export function EventsDetailPageBody(props: EventsDetailPageViewProps) {
  const {
    methods,
    pt,
    deletion,
    media,
    canUploadMedia,
    canUpdateMedia,
    navigate,
    formId,
    submit,
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
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="space-y-5">
        <EventsDetailStatus {...props} />
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
            pickerMode === 'upload'
              ? media.mediaPicker.openUpload()
              : media.mediaPicker.openLibrary()
          }
        />
      </form>
    </>
  );
}
