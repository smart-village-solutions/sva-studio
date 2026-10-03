import { alignHostMediaReferencesByOrder, listHostMediaReferencesByTarget } from '@sva/plugin-sdk';
import {
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  type ContentMediaUsage,
  type MainserverPrincipalType,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { getProjectDetail } from './projects.api.js';
import type { ProjectContentItem } from './projects.api-types.js';
import { projectImagesToMediaUsages } from './projects.content-media-adapter.js';
import { projectToFormValues } from './projects.model.js';
import type { ProjectFormValues } from './projects.validation.js';

export function useProjectEditorLoad({
  mode,
  contentId,
  actingPrincipalType,
  form,
  setMediaUsages,
  setRequiresReferenceSync,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  form: UseFormReturn<ProjectFormValues>;
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  const [item, setItem] = React.useState<ProjectContentItem>();
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [loadError, setLoadError] = React.useState(false);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const loadedContentIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    if (loadedContentIdRef.current === contentId) {
      void getProjectDetail(contentId, actingPrincipalType)
        .then((detail) => {
          if (active) setResourceAccess(detail.access);
        })
        .catch(() => {
          if (active) setResourceAccess({});
        });
      return () => {
        active = false;
      };
    }
    void getProjectDetail(contentId, actingPrincipalType)
      .then(async (detail) => {
        if (!active) return;
        const project = detail.data;
        setResourceAccess(detail.access);
        const references = await listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'projects.project',
          targetId: contentId,
        }).catch(() => []);
        if (!active) return;
        setItem(project);
        loadedContentIdRef.current = contentId;
        form.reset(projectToFormValues(project));
        const alignments = alignHostMediaReferencesByOrder({
          itemCount: project.images.length,
          role: 'gallery_item',
          references,
        });
        setMediaUsages(projectImagesToMediaUsages(project.images, alignments));
        setRequiresReferenceSync(references.length > 0);
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [actingPrincipalType, contentId, form, mode, setMediaUsages, setRequiresReferenceSync]);

  return { item, setItem, loading, loadError, resourceAccess };
}

export function useProjectCreatedFeedback({
  loading,
  locationState,
  contentId,
  navigate,
  saveFeedback,
}: Readonly<{
  loading: boolean;
  locationState: unknown;
  contentId?: string;
  navigate: ReturnType<typeof useNavigate>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}>) {
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      loading ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(locationState, 'projects', contentId)
    )
      return;
    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/projects/$id',
      params: { id: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [contentId, loading, locationState, navigate, saveFeedback]);
}
