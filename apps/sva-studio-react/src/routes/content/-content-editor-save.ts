import type { useContentDetail, useCreateContent } from '../../hooks/use-contents';
import { parseOptionalEditorDateTime } from '../../lib/editor-date-time';
import type { CreateContentPayload, UpdateContentPayload } from '../../lib/iam-api';
import { parseContentPayload, type ContentFormState } from './-content-editor-form';

type SaveContentInput = {
  readonly mode: 'create' | 'edit';
  readonly values: ContentFormState;
  readonly contentId?: string;
  readonly originalPublishedAt?: string;
  readonly createContent: ReturnType<typeof useCreateContent>['createContent'];
  readonly updateContent: ReturnType<typeof useContentDetail>['updateContent'];
  readonly onCreated: (contentId: string) => Promise<void>;
};

export const saveContentValues = async ({
  mode,
  values,
  contentId,
  originalPublishedAt,
  createContent,
  updateContent,
  onCreated,
}: SaveContentInput): Promise<boolean> => {
  if (mode === 'edit' && !contentId) {
    return false;
  }
  const parsedPayload = parseContentPayload(values.payloadText);
  if (!parsedPayload.ok) {
    return false;
  }
  const publishedAt = parseOptionalEditorDateTime(values.publishedAt, originalPublishedAt);
  if (publishedAt.kind === 'invalid') {
    return false;
  }

  if (mode === 'create') {
    const payload: CreateContentPayload = {
      title: values.title.trim(),
      contentType: values.contentType,
      status: values.status,
      publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
      payload: parsedPayload.payload as CreateContentPayload['payload'],
    };
    const created = await createContent(payload);
    if (created) {
      await onCreated(created.id);
    }
    return Boolean(created);
  }

  const payload: UpdateContentPayload = {
    title: values.title.trim(),
    status: values.status,
    publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
    payload: parsedPayload.payload as UpdateContentPayload['payload'],
  };
  return updateContent(payload);
};
