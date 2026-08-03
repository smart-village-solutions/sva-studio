import { zodResolver } from '@hookform/resolvers/zod';
import {
  listHostMediaAssets,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  Button,
  Input,
  RichTextHtmlEditor,
  Select,
  StudioConfirmDialog,
  StudioDataTable,
  StudioDetailCard,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
  Textarea,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects.api.js';
import type { ProjectContentItem } from './projects.api-types.js';
import {
  createDefaultProjectFormValues,
  normalizeProjectInput,
  projectToFormValues,
} from './projects.model.js';
import { projectFormSchema, type ProjectFormValues } from './projects.validation.js';

type ProjectTab = 'basis' | 'content' | 'settings';
type Translate = ReturnType<typeof usePluginTranslation>;

const richTextOptions = (pt: Translate) => [
  { value: 'paragraph' as const, label: pt('richText.paragraph') },
  { value: 'heading-2' as const, label: pt('richText.heading2') },
  { value: 'heading-3' as const, label: pt('richText.heading3') },
  { value: 'heading-4' as const, label: pt('richText.heading4') },
  { value: 'blockquote' as const, label: pt('richText.blockquote') },
];

const richTextLabels = (pt: Translate) => ({
  blockType: pt('richText.blockType'),
  bulletList: pt('richText.bulletList'),
  orderedList: pt('richText.orderedList'),
  bold: pt('richText.bold'),
  italic: pt('richText.italic'),
  undo: pt('richText.undo'),
  redo: pt('richText.redo'),
  link: pt('richText.applyLink'),
  linkPrompt: pt('richText.linkInput'),
});

function ProjectImages({ form, pt }: Readonly<{
  form: ReturnType<typeof useForm<ProjectFormValues>>;
  pt: Translate;
}>) {
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'images' });
  const [assets, setAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [mediaError, setMediaError] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void listHostMediaAssets({
      fetch: globalThis.fetch.bind(globalThis),
      visibility: 'public',
    }).then(
      (items) =>
        active &&
        setAssets(items.filter((item) => item.mimeType?.startsWith('image/') && item.previewUrl)),
      () => active && setMediaError(true)
    );
    return () => {
      active = false;
    };
  }, []);

  const appendImage = (url: string | null | undefined) => {
    if (!url || form.getValues('images').some((image) => image.url === url)) return;
    append({ url, altText: '', caption: '', credits: '', position: fields.length });
  };

  const moveImage = (from: number, to: number) => {
    const images = [...form.getValues('images')];
    const [image] = images.splice(from, 1);
    if (!image) return;
    images.splice(to, 0, image);
    replace(images.map((entry, position) => ({ ...entry, position })));
  };

  return (
    <StudioDetailCard
      title={pt('fields.images')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label={pt('actions.selectImage')}
            defaultValue=""
            onChange={(event) => {
              appendImage(event.currentTarget.value);
              event.currentTarget.value = '';
            }}
          >
            <option value="">{pt('actions.selectImage')}</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.previewUrl ?? ''}>
                {asset.fileName ?? asset.id}
              </option>
            ))}
          </Select>
          <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium">
            <span>{pt(uploading ? 'actions.uploadingImage' : 'actions.uploadImage')}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                setUploading(true);
                void uploadHostMediaFile({
                  fetch: globalThis.fetch.bind(globalThis),
                  file,
                  visibility: 'public',
                  mediaType: 'image',
                })
                  .then((result) => appendImage(result.previewUrl), () => setMediaError(true))
                  .finally(() => setUploading(false));
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({ url: '', altText: '', caption: '', credits: '', position: fields.length })
            }
          >
            {pt('actions.addImage')}
          </Button>
        </div>
      }
    >
      {mediaError ? <p role="alert" className="text-sm text-destructive">{pt('messages.mediaError')}</p> : null}
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">{pt('messages.imagePreviewEmpty')}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {fields.map((field, index) => {
          const imageUrl = form.watch(`images.${index}.url`);
          return (
            <article key={field.id} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <div className="aspect-video bg-muted">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    {pt('messages.imagePreviewEmpty')}
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <StudioField id={`project-image-url-${index}`} label={pt('fields.imageUrl')}>
                  <Input id={`project-image-url-${index}`} type="url" {...form.register(`images.${index}.url`)} />
                </StudioField>
                <StudioField id={`project-image-alt-${index}`} label={pt('fields.altText')}>
                  <Input id={`project-image-alt-${index}`} {...form.register(`images.${index}.altText`)} />
                </StudioField>
                <StudioField id={`project-image-caption-${index}`} label={pt('fields.caption')}>
                  <Input id={`project-image-caption-${index}`} {...form.register(`images.${index}.caption`)} />
                </StudioField>
                <StudioField id={`project-image-credits-${index}`} label={pt('fields.credits')}>
                  <Input id={`project-image-credits-${index}`} {...form.register(`images.${index}.credits`)} />
                </StudioField>
                <input type="hidden" {...form.register(`images.${index}.position`, { valueAsNumber: true })} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveImage(index, index - 1)}
                  >
                    {pt('actions.moveImageUp')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === fields.length - 1}
                    onClick={() => moveImage(index, index + 1)}
                  >
                    {pt('actions.moveImageDown')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => remove(index)}>
                    {pt('actions.removeImage')}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </StudioDetailCard>
  );
}

function ProjectEditor({ mode, contentId }: Readonly<{ mode: 'create' | 'edit'; contentId?: string }>) {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const form = useForm<ProjectFormValues>({
    defaultValues: createDefaultProjectFormValues(),
    resolver: zodResolver(projectFormSchema),
  });
  const [tab, setTab] = React.useState<ProjectTab>('basis');
  const [item, setItem] = React.useState<ProjectContentItem>();
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [loadError, setLoadError] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string>();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    void getProject(contentId)
      .then(
        (project) => {
          if (!active) return;
          setItem(project);
          form.reset(projectToFormValues(project));
        },
        () => active && setLoadError(true)
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [contentId, form, mode]);

  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;

  const save = form.handleSubmit(
    async (values) => {
      setMutationError(undefined);
      try {
        const input = normalizeProjectInput({
          ...values,
          images: values.images.map((image, position) => ({ ...image, position })),
        });
        if (mode === 'create') {
          const created = await createProject(input);
          await navigate({ to: '/admin/projects/$id', params: { id: created.id } });
        } else if (contentId) {
          const updated = await updateProject(contentId, input);
          setItem(updated);
          form.reset(projectToFormValues(updated));
        }
      } catch {
        setMutationError(pt('messages.saveError'));
      }
    },
    (errors) => {
      setMutationError(pt('validation.summary'));
      if (errors.fullText || errors.images) setTab('content');
      else if (errors.status || errors.author) setTab('settings');
      else setTab('basis');
    }
  );

  const summaryErrors = Object.entries(form.formState.errors).map(([field, error]) => ({
    field: `project-${field}`,
    message: error?.message?.toString() ?? pt('validation.summary'),
  }));
  const formId = `project-${mode}-form`;
  const fullText = form.watch('fullText');
  const authorType = form.watch('author.type');
  const tabs: readonly StudioDetailTabDefinition<ProjectTab>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis'),
      icon: 'basis',
      panel: (
        <div className="space-y-4">
          <StudioField id="project-language" label={pt('fields.language')}>
            <Input id="project-language" {...form.register('language')} />
          </StudioField>
          <StudioField id="project-title" label={pt('fields.title')}>
            <Input id="project-title" {...form.register('title')} />
          </StudioField>
          <StudioField id="project-description" label={pt('fields.description')}>
            <Textarea id="project-description" className="min-h-28" {...form.register('description')} />
          </StudioField>
        </div>
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content'),
      icon: 'content',
      panel: (
        <div className="space-y-5">
          <StudioDetailCard title={pt('fields.fullText')}>
            <div className="space-y-1">
              <label id="project-full-text-label" htmlFor="project-fullText" className="text-sm font-medium">
                {pt('fields.fullText')}
              </label>
              <Controller
                control={form.control}
                name="fullText"
                render={({ field }) => (
                  <RichTextHtmlEditor
                    id="project-fullText"
                    labelId="project-full-text-label"
                    value={fullText}
                    onChange={field.onChange}
                    blockTypeOptions={richTextOptions(pt)}
                    toolbarLabels={richTextLabels(pt)}
                  />
                )}
              />
            </div>
          </StudioDetailCard>
          <ProjectImages form={form} pt={pt} />
        </div>
      ),
    },
    {
      id: 'settings',
      label: pt('tabs.settings'),
      icon: 'settings',
      panel: (
        <div className="space-y-4">
          <StudioField id="project-status" label={pt('fields.status')}>
            <Select id="project-status" {...form.register('status')}>
              <option value="draft">{pt('status.draft')}</option>
              <option value="published">{pt('status.published')}</option>
              <option value="archived">{pt('status.archived')}</option>
            </Select>
          </StudioField>
          <StudioField id="project-author-type" label={pt('fields.authorType')}>
            <Select id="project-author-type" {...form.register('author.type')}>
              <option value="organization">{pt('author.organization')}</option>
              <option value="person">{pt('author.person')}</option>
            </Select>
          </StudioField>
          <StudioField id="project-author-id" label={pt('fields.authorId')}>
            <Input id="project-author-id" {...form.register('author.id')} />
          </StudioField>
          <StudioField id="project-author-name" label={pt('fields.authorName')}>
            <Input id="project-author-name" {...form.register('author.displayName')} />
          </StudioField>
          <input type="hidden" value={authorType} readOnly />
          {item ? (
            <StudioDetailCard title={pt('tabs.settings')}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="font-medium">{pt('fields.published')}</dt><dd>{pt(item.published ? 'fields.yes' : 'fields.no')}</dd></div>
                <div><dt className="font-medium">{pt('fields.publishedAt')}</dt><dd>{item.publishedAt ?? pt('fields.notAvailable')}</dd></div>
                <div><dt className="font-medium">{pt('fields.createdAt')}</dt><dd>{item.createdAt}</dd></div>
                <div><dt className="font-medium">{pt('fields.updatedAt')}</dt><dd>{item.updatedAt}</dd></div>
              </dl>
            </StudioDetailCard>
          ) : null}
        </div>
      ),
    },
  ];

  const removeProject = async () => {
    if (!contentId) return;
    setDeletePending(true);
    try {
      await deleteProject(contentId);
      await navigate({ to: '/admin/content' });
    } catch {
      setMutationError(pt('messages.deleteError'));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      description={pt(mode === 'create' ? 'editor.createDescription' : 'editor.editDescription')}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/admin/content">{pt('actions.back')}</Link></Button>
          {mode === 'edit' ? (
            <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={<Button type="submit" form={formId} disabled={form.formState.isSubmitting}>{pt(mode === 'create' ? 'actions.create' : 'actions.update')}</Button>}
    >
      <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
        {mutationError ? <p role="alert" className="text-sm text-destructive">{mutationError}</p> : null}
        <StudioFormSummaryErrors errors={summaryErrors} title={pt('validation.summary')} />
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.ariaLabel')}
          tabs={tabs}
          value={tab}
          onValueChange={setTab}
          keepMounted
        />
      </form>
      <StudioConfirmDialog
        open={deleteDialogOpen}
        title={pt('messages.deleteTitle')}
        description={pt('messages.deleteDescription')}
        confirmLabel={pt('actions.delete')}
        cancelLabel={pt('actions.back')}
        confirmDisabled={deletePending}
        cancelDisabled={deletePending}
        onConfirm={() => void removeProject()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </StudioDetailPageTemplate>
  );
}

export function ProjectsListPage() {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page ?? 1) : 1;
  const pageSize = search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25;
  const [items, setItems] = React.useState<readonly ProjectContentItem[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [hasNextPage, setHasNextPage] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void listProjects({ page, pageSize }).then(
      (result) => {
        if (!active) return;
        setItems(result.data);
        setHasNextPage(result.pagination.hasNextPage);
        setState('ready');
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [page, pageSize]);

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={<Button asChild><Link to="/admin/projects/new">{pt('actions.create')}</Link></Button>}
    >
      {state === 'loading' ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
      {state === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {state === 'ready' && items.length === 0 ? <StudioEmptyState>{pt('messages.empty')}</StudioEmptyState> : null}
      {state === 'ready' && items.length > 0 ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            data={items}
            columns={[
              { id: 'title', header: pt('fields.title'), cell: (item) => item.title },
              { id: 'language', header: pt('fields.language'), cell: (item) => item.language },
              { id: 'status', header: pt('fields.status'), cell: (item) => pt(`status.${item.status}`) },
            ]}
            rowActions={(project) => <Button asChild variant="outline" size="sm"><Link to="/admin/projects/$id" params={{ id: project.id }}>{pt('actions.edit')}</Link></Button>}
            getRowId={(project) => project.id}
            selectionMode="none"
            emptyState={null}
            labels={{
              selectionColumn: pt('fields.actions'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
          />
          <StudioPagination
            page={page}
            hasNextPage={hasNextPage}
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel', { page })}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={(nextPage) => void navigate({ to: '/admin/projects', search: (current: Record<string, unknown>) => ({ ...current, page: nextPage, pageSize }) })}
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const ProjectsCreatePage = () => <ProjectEditor mode="create" />;

export const ProjectsEditPage = () => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return <ProjectEditor mode="edit" contentId={params.contentId ?? params.id} />;
};
