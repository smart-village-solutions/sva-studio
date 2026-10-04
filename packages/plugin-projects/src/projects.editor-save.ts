import {
  contentMediaSavePhaseMessageKey,
  saveContentWithHostMediaReferences,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  addStudioCreatedSaveFeedback,
  contentMediaUsageToReference,
  contentMediaUsagesToLocalDrafts,
  resolveContentMediaUsageDrafts,
  type ContentMediaUsage,
  type MainserverPrincipalType,
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { createProject, ProjectsApiError, updateProject } from './projects.api.js';
import type { ProjectContentItem } from './projects.api-types.js';
import { projectMediaUsagesToImages } from './projects.content-media-adapter.js';
import { normalizeProjectInput, projectToFormValues } from './projects.model.js';
import type { ProjectTab } from './projects.editor-tabs.js';
import type { ProjectFormValues } from './projects.validation.js';

type Translate = ReturnType<typeof usePluginTranslation>;
type SaveInput = Readonly<{
  form: UseFormReturn<ProjectFormValues>;
  pt: Translate;
  mode: 'create' | 'edit';
  contentId?: string;
  canSave: boolean;
  actingPrincipalType: MainserverPrincipalType;
  mediaUsages: readonly ContentMediaUsage[];
  requiresReferenceSync: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
  setMutationError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setRetryCreatedContentId: React.Dispatch<React.SetStateAction<string | null>>;
  setItem: React.Dispatch<React.SetStateAction<ProjectContentItem | undefined>>;
  setTab: React.Dispatch<React.SetStateAction<ProjectTab>>;
  navigate: ReturnType<typeof useNavigate>;
}>;

function saveProjectContent(values: ProjectFormValues, input: SaveInput) {
  return (
    draftResolutions: Parameters<typeof resolveContentMediaUsageDrafts>[1] = [],
    mediaSaveContext?: Readonly<{ operationId: string }>
  ) => {
    const projectInput = normalizeProjectInput({
      ...values,
      images: projectMediaUsagesToImages(
        resolveContentMediaUsageDrafts(input.mediaUsages, draftResolutions)
      ).map((image, position) => ({ ...image, position })),
    });
    const mutationOptions = mediaSaveContext
      ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
      : undefined;
    if (input.mode === 'create') {
      return mutationOptions
        ? createProject(projectInput, input.actingPrincipalType, mutationOptions)
        : createProject(projectInput, input.actingPrincipalType);
    }
    return mutationOptions
      ? updateProject(
          input.contentId as string,
          projectInput,
          input.actingPrincipalType,
          mutationOptions
        )
      : updateProject(input.contentId as string, projectInput, input.actingPrincipalType);
  };
}

async function persistProject(values: ProjectFormValues, input: SaveInput) {
  const saveContent = saveProjectContent(values, input);
  return input.requiresReferenceSync
    ? saveContentWithHostMediaReferences({
        fetch: globalThis.fetch.bind(globalThis),
        saveContent,
        getTargetId: (saved) => saved.id,
        targetType: 'projects.project',
        references: input.mediaUsages.flatMap((usage) => {
          const reference = contentMediaUsageToReference(usage);
          return reference ? [reference] : [];
        }),
        drafts: contentMediaUsagesToLocalDrafts(input.mediaUsages),
        onPhaseChange: (phase) =>
          input.setMediaSavePhaseKey(contentMediaSavePhaseMessageKey(phase)),
      })
    : { status: 'complete' as const, saved: await saveContent(), resolutions: [] };
}

async function completeProjectSave(
  result: Awaited<ReturnType<typeof persistProject>>,
  input: SaveInput,
  operationId: number
) {
  const handledResult = input.mediaReferenceSync.consumeSaveResult(result);
  if (handledResult.referenceFailed) {
    input.setRetryCreatedContentId(input.mode === 'create' ? result.saved.id : null);
    input.setMutationError(input.pt('messages.mediaReferencePartialFailure'));
    input.saveFeedback.markFailed(operationId);
    return;
  }
  input.setRetryCreatedContentId(null);
  input.saveFeedback.markSaved(operationId);
  if (input.mode === 'create') {
    await input.navigate({
      to: '/admin/projects/$id',
      params: { id: result.saved.id },
      state: (previous) => addStudioCreatedSaveFeedback(previous, 'projects', result.saved.id),
    });
  } else if (input.contentId) {
    input.setItem(result.saved);
    input.form.reset(projectToFormValues(result.saved));
  }
}

export function createProjectSaveHandler(input: SaveInput) {
  return input.form.handleSubmit(
    async (values) => {
      if (!input.canSave) return;
      if (input.mediaReferenceSync.hasPendingRetry) {
        input.setMutationError(input.pt('messages.mediaReferencePartialFailure'));
        return;
      }
      input.setMutationError(undefined);
      const operationId = input.saveFeedback.beginSaving();
      input.setMediaSavePhaseKey(null);
      try {
        await completeProjectSave(await persistProject(values, input), input, operationId);
      } catch (error) {
        if (
          globalThis.location.hostname === 'localhost' ||
          globalThis.location.hostname.endsWith('.localhost')
        ) {
          console.error('Project save failed', error);
        }
        input.setMutationError(
          error instanceof ProjectsApiError && error.message.trim()
            ? input.pt('messages.saveErrorWithReason', { reason: error.message })
            : input.pt('messages.saveError')
        );
        input.saveFeedback.markFailed(operationId);
      }
    },
    (errors) => {
      input.saveFeedback.reset();
      input.setMutationError(input.pt('validation.summary'));
      if (errors.fullText || errors.images) input.setTab('content');
      else if (errors.status) input.setTab('settings');
      else input.setTab('basis');
    }
  );
}
