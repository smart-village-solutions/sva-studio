import { loadProjectAssetSnapshot } from './projects.images.js';
import { ProjectHistoryTab } from './projects.history.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ContentOwnershipPanelSlot,
  Input,
  RichTextHtmlEditor,
  Select,
  StudioDetailCard,
  StudioField,
  Textarea,
  type ContentMediaUsage,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import type { ProjectContentItem } from './projects.api-types.js';
import { ProjectImages } from './projects.images.js';
import type { ProjectFormValues } from './projects.validation.js';

export type ProjectTab = 'basis' | 'content' | 'settings' | 'history';
type Translate = ReturnType<typeof usePluginTranslation>;
type TabInput = Readonly<{
  pt: Translate;
  form: UseFormReturn<ProjectFormValues>;
  mode: 'create' | 'edit';
  contentId?: string;
  item?: ProjectContentItem;
  mediaUsages: readonly ContentMediaUsage[];
  onMediaChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  mediaEditingDisabled: boolean;
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
}>;

function ProjectLanguageField({ pt, form }: Pick<TabInput, 'pt' | 'form'>) {
  return (
    <StudioField
      id="project-language"
      label={pt('fields.language')}
      description={pt('create.languageHelp')}
    >
      <Input
        id="project-language"
        aria-describedby="project-language-description"
        aria-invalid={Boolean(form.formState.errors.language)}
        {...form.register('language')}
      />
    </StudioField>
  );
}

function BasisTab({ pt, form, mode }: TabInput) {
  return (
    <div className="space-y-4">
      {mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
      {mode === 'edit' ? <ProjectLanguageField pt={pt} form={form} /> : null}
      <StudioField id="project-title" label={pt('fields.title')} required>
        <Input
          id="project-title"
          aria-required="true"
          aria-invalid={Boolean(form.formState.errors.title)}
          {...form.register('title')}
        />
      </StudioField>
      <StudioField
        id="project-description"
        label={pt('fields.description')}
        description={pt('create.optional')}
      >
        <Textarea
          id="project-description"
          aria-describedby="project-description-description"
          className="min-h-28"
          aria-invalid={Boolean(form.formState.errors.description)}
          {...form.register('description')}
        />
      </StudioField>
    </div>
  );
}

const richTextOptions = (pt: Translate) => [
  { value: 'paragraph' as const, label: pt('richText.paragraph') },
  { value: 'heading-2' as const, label: pt('richText.heading2') },
  { value: 'heading-3' as const, label: pt('richText.heading3') },
  { value: 'heading-4' as const, label: pt('richText.heading4') },
  { value: 'blockquote' as const, label: pt('richText.blockquote') },
];

const richTextLabels = (pt: Translate) => ({
  mode: pt('richText.mode'),
  visualMode: pt('richText.visualMode'),
  htmlMode: pt('richText.htmlMode'),
  blockType: pt('richText.blockType'),
  bulletList: pt('richText.bulletList'),
  orderedList: pt('richText.orderedList'),
  bold: pt('richText.bold'),
  italic: pt('richText.italic'),
  underline: pt('richText.underline'),
  clearFormatting: pt('richText.clearFormatting'),
  undo: pt('richText.undo'),
  redo: pt('richText.redo'),
  link: pt('richText.applyLink'),
  linkPrompt: pt('richText.linkInput'),
});

function ContentTab(props: TabInput) {
  const { pt, form } = props;
  return (
    <div className="space-y-6">
      <StudioDetailCard
        title={pt(props.mode === 'create' ? 'tabs.content' : 'fields.fullText')}
        description={props.mode === 'create' ? undefined : pt('create.optional')}
      >
        {props.mode === 'create' ? <BasisTab {...props} /> : null}
        <div className="space-y-1">
          <label
            id="project-full-text-label"
            htmlFor="project-fullText"
            className="text-sm font-medium"
          >
            {pt('fields.fullText')}
          </label>
          <Controller
            control={form.control}
            name="fullText"
            render={({ field }) => (
              <RichTextHtmlEditor
                id="project-fullText"
                labelId="project-full-text-label"
                ariaInvalid={Boolean(form.formState.errors.fullText)}
                value={form.watch('fullText')}
                onChange={field.onChange}
                blockTypeOptions={richTextOptions(pt)}
                toolbarLabels={richTextLabels(pt)}
              />
            )}
          />
        </div>
      </StudioDetailCard>
      <details open={props.mode === 'create' ? undefined : true}>
        <summary hidden={!(props.mode === 'create')}>{pt('fields.images')}</summary>
        <ProjectImages
          form={form}
          pt={pt}
          usages={props.mediaUsages}
          onChange={props.onMediaChange}
          canSelectMedia={props.canSelectMedia}
          canUploadMedia={props.canUploadMedia}
          mediaEditingDisabled={props.mediaEditingDisabled}
          onAddManualMedia={props.onAddManualMedia}
          onOpenMediaPicker={props.onOpenMediaPicker}
          onLoadAssetSnapshot={loadProjectAssetSnapshot}
        />
      </details>
    </div>
  );
}

function SettingsTab({ pt, form, item }: TabInput) {
  return (
    <div className="space-y-4">
      <StudioField
        id="project-status"
        label={pt('fields.status')}
        description={pt('create.statusHelp')}
      >
        <Select
          id="project-status"
          aria-describedby="project-status-description"
          aria-invalid={Boolean(form.formState.errors.status)}
          {...form.register('status')}
        >
          <option value="draft">{pt('status.draft')}</option>
          <option value="published">{pt('status.published')}</option>
          <option value="archived">{pt('status.archived')}</option>
        </Select>
      </StudioField>
      {item ? (
        <StudioDetailCard title={pt('tabs.settings')}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">{pt('fields.published')}</dt>
              <dd>{pt(item.published ? 'fields.yes' : 'fields.no')}</dd>
            </div>
            <div>
              <dt className="font-medium">{pt('fields.publishedAt')}</dt>
              <dd>{item.publishedAt ?? pt('fields.notAvailable')}</dd>
            </div>
            <div>
              <dt className="font-medium">{pt('fields.createdAt')}</dt>
              <dd>{item.createdAt}</dd>
            </div>
            <div>
              <dt className="font-medium">{pt('fields.updatedAt')}</dt>
              <dd>{item.updatedAt}</dd>
            </div>
          </dl>
        </StudioDetailCard>
      ) : null}
    </div>
  );
}

export function createProjectTabs(
  input: TabInput
): readonly StudioDetailTabDefinition<ProjectTab>[] {
  if (input.mode === 'create') {
    return [
      {
        id: 'content',
        label: input.pt('tabs.content'),
        panel: (
          <div className="space-y-6">
            <ContentTab {...input} />
            <StudioDetailCard title={input.pt('create.settingsTitle')}>
              <ProjectLanguageField {...input} />
              <SettingsTab {...input} />
            </StudioDetailCard>
          </div>
        ),
      },
    ];
  }
  return [
    { id: 'basis', label: input.pt('tabs.basis'), icon: 'basis', panel: <BasisTab {...input} /> },
    {
      id: 'content',
      label: input.pt('tabs.content'),
      icon: 'content',
      panel: <ContentTab {...input} />,
    },
    {
      id: 'settings',
      label: input.pt('tabs.settings'),
      icon: 'settings',
      panel: <SettingsTab {...input} />,
    },
    {
      id: 'history',
      label: input.pt('tabs.history'),
      icon: 'history',
      panel: <ProjectHistoryTab {...input} />,
    },
  ];
}
