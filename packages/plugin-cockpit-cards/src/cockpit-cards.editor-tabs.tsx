import { usePluginTranslation } from '@sva/plugin-sdk';
import { type StudioDetailTabDefinition, type useStudioSaveFeedback } from '@sva/studio-ui-react';
import type { UseFormReturn } from 'react-hook-form';

import { ContentFields } from './cockpit-cards.content-fields.js';
import { BasisFields, SettingsFields } from './cockpit-cards.editor-fields.js';
import type { useCockpitCardMedia } from './cockpit-cards.editor-media.js';
import type { Tab } from './cockpit-cards.editor-view.js';
import { CockpitCardsHistory } from './cockpit-cards.history.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';

function contentTab({
  pt,
  form,
  media,
  canSelectMedia,
  canUploadMedia,
  saveFeedback,
}: Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  form: UseFormReturn<CockpitCardFormValues>;
  media: ReturnType<typeof useCockpitCardMedia>;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}>): StudioDetailTabDefinition<Tab> {
  const { mediaUsages, setMediaUsages, mediaPicker, addManualMedia, loadAssetSnapshot } = media;
  return {
    id: 'content',
    label: pt('tabs.content.label'),
    title: pt('tabs.content.title'),
    description: pt('tabs.content.description'),
    icon: 'content',
    panel: (
      <ContentFields
        form={form}
        pt={pt}
        mediaUsages={mediaUsages}
        onMediaUsagesChange={setMediaUsages}
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        mediaEditingDisabled={saveFeedback.status === 'saving'}
        onAddManualMedia={addManualMedia}
        onOpenMediaPicker={(pickerMode) =>
          pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
        }
        onLoadAssetSnapshot={loadAssetSnapshot}
      />
    ),
  };
}

export function cockpitCardEditorTabs({
  pt,
  form,
  mode,
  contentId,
  link,
  options,
  categoriesState,
  media,
  canSelectMedia,
  canUploadMedia,
  saveFeedback,
}: Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  form: UseFormReturn<CockpitCardFormValues>;
  mode: 'create' | 'edit';
  contentId?: string;
  link: string;
  options: readonly { id: string; name: string }[];
  categoriesState: 'loading' | 'error' | 'ready';
  media: ReturnType<typeof useCockpitCardMedia>;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}>): readonly StudioDetailTabDefinition<Tab>[] {
  return [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      icon: 'basis',
      panel: (
        <BasisFields
          form={form}
          pt={pt}
          mode={mode}
          options={options}
          categoriesState={categoriesState}
        />
      ),
    },
    contentTab({ pt, form, media, canSelectMedia, canUploadMedia, saveFeedback }),
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      icon: 'settings',
      panel: <SettingsFields form={form} pt={pt} link={link} />,
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      icon: 'history',
      isVisible: mode === 'edit' && Boolean(contentId),
      panel: contentId ? <CockpitCardsHistory contentId={contentId} /> : null,
    },
  ];
}
