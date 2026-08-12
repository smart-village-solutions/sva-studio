import {
  hasContentLifecycleAccess,
  readSessionAccessSnapshot,
  resolveContentLifecycleAction,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
  type StandardContentAccessCapabilities,
} from '@sva/plugin-sdk';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import type { SurveyEditorMode } from './surveys.editor.shared.js';

const surveyLifecycleStatus = {
  DRAFT: 'draft',
  ACTIVE: 'published',
  ARCHIVED: 'archived',
} as const;

export const canMutateSurvey = (input: {
  readonly mode: SurveyEditorMode;
  readonly canUpdate: boolean;
  readonly accessCapabilities: StandardContentAccessCapabilities;
  readonly loadedStatus?: keyof typeof surveyLifecycleStatus;
  readonly nextStatus: SurveyDetailFormValues['basis']['status'];
  readonly resourceAccess: Readonly<Record<string, boolean>>;
}) => {
  const canEdit =
    input.mode === 'create'
      ? input.accessCapabilities.canCreate
      : input.canUpdate && input.accessCapabilities.canUpdate && input.loadedStatus !== undefined;
  const lifecycleAllowed =
    input.mode === 'create' ||
    (input.loadedStatus !== undefined &&
      hasContentLifecycleAccess(
        resolveContentLifecycleAction(
          surveyLifecycleStatus[input.loadedStatus],
          surveyLifecycleStatus[input.nextStatus]
        ),
        input.resourceAccess
      ));
  return {
    canEdit,
    canSave: canEdit && lifecycleAllowed,
  };
};

export const useSurveyMutationAccess = (
  mode: SurveyEditorMode,
  canUpdate: boolean,
  loadedStatus: keyof typeof surveyLifecycleStatus | undefined,
  resourceAccess: Readonly<Record<string, boolean>>,
  methods: UseFormReturn<SurveyDetailFormValues>
) => {
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('surveys', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  return canMutateSurvey({
    mode,
    canUpdate,
    accessCapabilities,
    loadedStatus,
    nextStatus: methods.watch('basis.status'),
    resourceAccess,
  });
};
