import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  SearchableMultiSelect,
  Select,
  StudioDetailCard,
  StudioField,
  StudioSwitch,
  RichTextHtmlEditor,
} from '@sva/studio-ui-react';
import { TrafficFields, LocationFields } from './construction-sites.traffic-fields.js';
import { ConstructionSiteMediaFields } from './construction-sites.form-media.js';

export { constructionSiteFieldId } from './construction-sites.form.js';
import {
  constructionSiteFieldId,
  type ConstructionSiteFormProps,
} from './construction-sites.form.js';
export type { ConstructionSiteFormProps } from './construction-sites.form.js';

export function ConstructionSiteBasisFields({
  draft,
  change,
  errors,
  canPublish,
}: ConstructionSiteFormProps) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <div className="space-y-6">
      <StudioDetailCard title={pt('tabs.basis')}>
        <StudioField
          id="cs-title"
          label={pt('fields.title')}
          required
          error={errors.includes('title') ? pt('validation.invalid') : undefined}
        >
          <Input
            id="cs-title"
            value={draft.title}
            onChange={(event) => change('title', event.currentTarget.value)}
            required
            aria-invalid={errors.includes('title')}
          />
        </StudioField>
      </StudioDetailCard>
      <StudioDetailCard title={pt('fields.dates')} description={pt('editor.primary')}>
        {draft.dates.map((date, index) => (
          <div key={date.sourceIndex ?? `new-${index}`} className="grid gap-4 sm:grid-cols-2">
            {(['dateStart', 'dateEnd'] as const).map((key) => (
              <StudioField
                key={key}
                id={constructionSiteFieldId(`dates.${index}.${key}`)}
                label={pt(`fields.${key}`)}
                required={index === 0}
                error={
                  errors.includes(`dates.${index}.${key}`) ? pt('validation.invalid') : undefined
                }
              >
                <Input
                  id={constructionSiteFieldId(`dates.${index}.${key}`)}
                  type="date"
                  value={date[key]}
                  required={index === 0}
                  aria-invalid={errors.includes(`dates.${index}.${key}`)}
                  onChange={(event) =>
                    change(
                      'dates',
                      draft.dates.map((item, position) =>
                        position === index ? { ...item, [key]: event.currentTarget.value } : item
                      )
                    )
                  }
                />
              </StudioField>
            ))}
          </div>
        ))}
      </StudioDetailCard>
      <StudioDetailCard title={pt('fields.visible')}>
        <div className="flex items-center gap-3">
          <StudioSwitch
            id="cs-visible"
            aria-describedby="cs-visible-description"
            checked={draft.visible}
            disabled={!canPublish}
            onCheckedChange={(checked) => change('visible', checked)}
          />
          <label htmlFor="cs-visible" className="text-sm text-foreground">
            {pt('fields.visible')}
          </label>
        </div>
        <p id="cs-visible-description" className="text-sm text-muted-foreground">
          {pt(draft.visible ? 'editor.visibleEffect' : 'editor.hiddenEffect')}
        </p>
      </StudioDetailCard>
    </div>
  );
}

function DescriptionFields({ draft, change, errors, disabled }: ConstructionSiteFormProps) {
  const pt = usePluginTranslation('construction-sites');
  const toolbarLabels = {
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
  };
  return (
    <StudioDetailCard title={pt('fields.description')} description={pt('editor.optional')}>
      {draft.contentBlocks.map((block, index) => (
        <RichTextHtmlEditor
          key={block.sourceIndex ?? `new-${index}`}
          disabled={disabled}
          id={constructionSiteFieldId(`contentBlocks.${index}.body`)}
          value={block.body}
          ariaInvalid={errors.includes(`contentBlocks.${index}.body`)}
          onChange={(body) =>
            change(
              'contentBlocks',
              draft.contentBlocks.map((item, position) =>
                index === position ? { ...item, body } : item
              )
            )
          }
          blockTypeOptions={[
            { value: 'paragraph', label: pt('richText.paragraph') },
            { value: 'heading-2', label: pt('richText.heading2') },
            { value: 'heading-3', label: pt('richText.heading3') },
          ]}
          toolbarLabels={toolbarLabels}
          labelId="cs-description-label"
        />
      ))}
      <span id="cs-description-label" className="sr-only">
        {pt('fields.description')}
      </span>
      {!draft.contentBlocks.length ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => change('contentBlocks', [{ body: '' }])}
        >
          {pt('actions.add')}
        </Button>
      ) : null}
    </StudioDetailCard>
  );
}

function CategoryFields({
  draft,
  change,
  categories,
  categoriesLoading,
  categoryError,
  disabled,
}: ConstructionSiteFormProps) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <details>
      <summary>
        {pt('fields.categories')} ({draft.categories.length})
      </summary>
      <p className="my-3 text-sm text-muted-foreground">{pt('editor.inactiveCategories')}</p>
      <StudioField id="cs-categories" label={pt('fields.categories')}>
        <SearchableMultiSelect
          id="cs-categories"
          disabled={disabled}
          options={categories.map(({ name }) => ({ value: name, label: name }))}
          value={draft.categories.map(({ name }) => name)}
          onValueChange={(names) =>
            change(
              'categories',
              names.map((name) => ({ name }))
            )
          }
          loading={categoriesLoading ?? false}
          errorMessage={categoryError ? pt('fields.categoryLoadError') : undefined}
          loadingText={pt('messages.categoriesLoading')}
          emptyText={pt('fields.categoriesEmpty')}
          helpText=""
          placeholder={pt('fields.categoriesPlaceholder')}
          searchLabel={pt('fields.categoriesSearch')}
          unavailableText={pt('fields.categoryUnavailable')}
          removeLabel={(name) => pt('actions.removeCategory', { name })}
        />
      </StudioField>
    </details>
  );
}
export function ConstructionSiteContentFields(props: ConstructionSiteFormProps) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <div className="space-y-6">
      <DescriptionFields {...props} />
      <TrafficFields {...props} />
      <LocationFields {...props} />
      <CategoryFields {...props} />
      <details id="cs-mediaContents">
        <summary id="cs-mediaContents-summary">
          {pt('fields.media')} ({props.draft.mediaContents.length})
        </summary>
        <p className="my-3 text-sm text-muted-foreground">{pt('messages.mediaPrimary')}</p>
        {props.draft.mediaContents.map((item, index) => (
          <StudioField
            key={item.sourceIndex ?? index}
            id={`cs-media-type-${index}`}
            label={pt('fields.mediaType')}
          >
            <Select
              id={`cs-media-type-${index}`}
              value={item.contentType}
              onChange={(event) =>
                props.change(
                  'mediaContents',
                  props.draft.mediaContents.map((entry, position) =>
                    position === index
                      ? {
                          ...entry,
                          contentType: event.currentTarget.value as typeof entry.contentType,
                        }
                      : entry
                  )
                )
              }
            >
              {(['image', 'audio', 'video', 'logo', 'attachement'] as const).map((type) => (
                <option key={type} value={type}>
                  {pt(`mediaTypes.${type}`)}
                </option>
              ))}
            </Select>
          </StudioField>
        ))}
        <ConstructionSiteMediaFields {...props} />
      </details>
    </div>
  );
}
