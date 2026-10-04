import { FormProvider, type UseFormReturn } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { resolveStandardContentAccessCapabilities, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioSaveButton,
  useStudioSaveFeedback,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import type { Dispatch, SetStateAction } from 'react';
import { EventsDetailPageBody } from './events.detail-page-body.js';
import { useEventsDetailDelete } from './events.detail-delete.js';
import { useEventsDetailMedia } from './events.detail-media.js';
import { createEventsDetailSubmit, type EventsStatusMessage } from './events.detail-save.js';
import type { EventsDetailFormValues } from './events.detail-form.js';
import type { EventsDetailTabDefinition, EventsDetailTabId } from './events.detail-tabs.js';
import type { EventCategoryOption, EventContentItem } from './events.types.js';

export type EventsDetailPageViewProps = Readonly<{
  methods: UseFormReturn<EventsDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
  mode: 'create' | 'edit';
  contentId?: string;
  formId: string;
  canSave: boolean;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  mediaSavePhaseKey: string | null;
  accessCapabilities: ReturnType<typeof resolveStandardContentAccessCapabilities>;
  deletion: ReturnType<typeof useEventsDetailDelete>;
  media: ReturnType<typeof useEventsDetailMedia>;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  canSelectMedia: boolean;
  navigate: ReturnType<typeof useNavigate>;
  submit: ReturnType<typeof createEventsDetailSubmit>;
  status: EventsStatusMessage | null;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: Dispatch<SetStateAction<MainserverPrincipalType>>;
  principalControl?: MainserverPrincipalControlModel;
  deviations: readonly { fieldGroup: string }[];
  deviationFieldLabels: Readonly<Record<string, string>>;
  tabs: readonly EventsDetailTabDefinition[];
  activeTab: EventsDetailTabId;
  handleTabChange: (tabId: EventsDetailTabId) => void;
  warmTab: (tabId: EventsDetailTabId) => void;
  visitedTabs: readonly EventsDetailTabId[];
  categoryOptions: readonly EventCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  loadedItem: EventContentItem | null;
  mediaReferencesReady: boolean;
  setStatus: Dispatch<SetStateAction<EventsStatusMessage | null>>;
}>;

const EventsDetailSaveAction = ({
  formId,
  saveFeedback,
  mediaSavePhaseKey,
  pt,
}: EventsDetailPageViewProps) => (
  <div className="flex flex-col items-end gap-1">
    <StudioSaveButton
      type="submit"
      form={formId}
      status={saveFeedback.status}
      labels={{
        idle: pt('actions.save'),
        saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
        saved: pt('actions.saved'),
      }}
    />
  </div>
);

const EventsDetailNavigationActions = ({
  mode,
  accessCapabilities,
  deletion,
  pt,
}: EventsDetailPageViewProps) => (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="secondary">
      <Link to="/admin/content">{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' && accessCapabilities.canDelete ? (
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          deletion.setError(null);
          deletion.setDialogOpen(true);
        }}
      >
        {pt('actions.delete')}
      </Button>
    ) : null}
  </div>
);

export function EventsDetailPageView(props: EventsDetailPageViewProps) {
  const { methods, mode, pt, canSave } = props;
  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
        description={
          mode === 'create' ? pt('detail.createDescription') : pt('detail.editDescription')
        }
        primaryAction={canSave ? <EventsDetailSaveAction {...props} /> : undefined}
        actions={<EventsDetailNavigationActions {...props} />}
      >
        <EventsDetailPageBody {...props} />
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
