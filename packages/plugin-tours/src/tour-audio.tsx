import { translatePluginKey, type usePluginTranslation } from '@sva/plugin-sdk';
import { ContentMediaUsageBlock, StudioMediaPickerOverlay } from '@sva/studio-ui-react';

import type { TourAudio } from './tour-edit-data.js';
import type { useTourAudio } from './tour-audio-state.js';

export { serializeTourAudio } from './tour-audio-data.js';
export { useTourAudio } from './tour-audio-state.js';

type Translate = ReturnType<typeof usePluginTranslation>;
type AudioEditor = ReturnType<typeof useTourAudio>;

const audioUsageLabels = (pt: Translate) => ({
  title: pt('ownAudio'),
  description: pt('audioDescription'),
  empty: pt('audioEmpty'),
  actions: {
    add: pt('addAudio'),
    remove: translatePluginKey('media', 'picker.removeFromContent'),
    moveUp: pt('moveUp'),
    moveDown: pt('moveDown'),
    refreshMetadata: pt('mediaLibrary'),
    cancel: pt('cancel'),
    apply: translatePluginKey('media', 'picker.useMedia'),
  },
  fields: {
    url: pt('audioUrl'),
    caption: pt('caption'),
    credit: pt('copyright'),
    altText: translatePluginKey('media', 'fields.altText'),
    license: translatePluginKey('media', 'fields.license'),
  },
  states: {
    linked: pt('mediaLibrary'),
    manual: pt('audioUrl'),
    synced: pt('audioReady'),
    pending: pt('audioPending'),
    missing: pt('mediaError'),
    additional: pt('mediaError'),
    unresolved: pt('mediaError'),
    failed: pt('mediaError'),
    previewUnavailable: translatePluginKey('media', 'picker.previewUnavailable'),
  },
  announcements: { moved: pt('audioMoved'), removed: pt('audioRemoved') },
  urlFeedback: {
    upgradedToHttps: translatePluginKey('media', 'picker.urlUpgradedToHttps'),
    insecureHttp: translatePluginKey('media', 'picker.urlInsecureHttp'),
    httpsUnavailable: translatePluginKey('media', 'picker.urlHttpsUnavailable'),
    invalid: pt('audioUrlInvalid'),
  },
  refresh: {
    title: pt('mediaLibrary'),
    description: pt('audioDescription'),
    assetValue: pt('mediaLibrary'),
    contentValue: pt('ownAudio'),
  },
});

const audioPickerLabels = (pt: Translate) => ({
  title: pt('addAudio'),
  description: pt('audioDescription'),
  modes: {
    library: pt('mediaLibrary'),
    upload: pt('audioUpload'),
    manual: pt('audioUrl'),
    review: pt('audioReview'),
  },
  library: {
    searchLabel: pt('audioSearch'),
    empty: pt('audioLibraryEmpty'),
    select: pt('audioSelect'),
    loading: pt('mediaLoading'),
    loadError: pt('mediaError'),
  },
  upload: {
    regionLabel: pt('audioUpload'),
    title: pt('audioUpload'),
    description: pt('audioDescription'),
    browseAction: pt('audioSelectFile'),
    supportLabel: pt('audioSupport'),
  },
  review: { title: pt('audioReview'), description: pt('audioMetadata') },
  fields: {
    title: pt('name'),
    description: pt('caption'),
    copyright: pt('copyright'),
    altText: translatePluginKey('media', 'fields.altText'),
    license: translatePluginKey('media', 'fields.license'),
  },
  actions: {
    cancel: pt('cancel'),
    backToLibrary: pt('mediaLibrary'),
    backToUpload: pt('audioUpload'),
    openMediaManagement: pt('media'),
    useMedia: translatePluginKey('media', 'picker.useMedia'),
  },
});

export function TourAudioFields({
  editor,
  target,
  inherited = [],
}: {
  editor: AudioEditor;
  target: string;
  inherited?: readonly TourAudio[];
}) {
  const { pt } = editor;
  const capability = editor.canSelect;
  return (
    <div className="space-y-3">
      {inherited.length > 0 ? (
        <div>
          <p className="font-medium">{pt('inheritedPoiAudio')}</p>
          <ul className="list-disc pl-5">
            {inherited.map((entry, index) => (
              <li key={entry.id ?? index}>{entry.captionText || entry.sourceUrl.url}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="font-medium">{pt('ownAudio')}</p>
      <ContentMediaUsageBlock
        addButtonId={`${target}-audio-add`}
        showHeader={false}
        usages={editor.audio[target] ?? []}
        onChange={(next) => editor.change(target, next)}
        onAddManual={(url) => editor.addManual(target, url)}
        onOpenLibrary={capability ? () => editor.open(target, 'library') : undefined}
        onOpenUpload={editor.canUpload ? () => editor.open(target, 'upload') : undefined}
        supportedFields={{ altText: false, caption: true, credit: true }}
        labels={audioUsageLabels(pt)}
      />
    </div>
  );
}

export function TourAudioPicker({ editor }: { editor: AudioEditor }) {
  const { picker, pt } = editor;
  return (
    <StudioMediaPickerOverlay
      allowAudio="only"
      canUpload={editor.canUpload}
      visibleMetadataFields={['description', 'copyright']}
      isMetadataEditable
      persistenceContext="content"
      assets={editor.assets}
      libraryStatus={{
        loading: editor.libraryState === 'loading',
        error: editor.libraryState === 'error',
        onRetry: editor.refreshAssetList,
      }}
      feedbackMessage={picker.errorCode ? pt('audioPickerError') : null}
      feedbackTone={picker.errorCode ? 'error' : 'default'}
      isLoadingReviewAsset={picker.isLoadingReviewAsset}
      isSavingReviewAsset={picker.isSavingReviewAsset}
      canConfirmSelection={picker.canConfirmSelection}
      labels={audioPickerLabels(pt)}
      metadataDraft={picker.metadataDraft}
      mode={picker.mode}
      onAddManual={(url) => editor.addManual(editor.target, url)}
      onBackFromReview={picker.goBackFromReview}
      onChangeMode={(mode) => editor.open(editor.target, mode)}
      onClose={picker.close}
      onConfirmSelection={(tags) => void picker.confirmSelection(tags)}
      onMetadataChange={(key, value) => picker.updateMetadataField(key, value)}
      onSearchValueChange={picker.setSearchValue}
      onSelectAsset={(asset) => void picker.selectAsset(asset)}
      onUploadFile={(file) => void picker.uploadFile(file)}
      open={picker.open}
      reviewAsset={picker.reviewAsset}
      reviewSource={picker.reviewSource}
      searchValue={picker.searchValue}
      uploadPhase={picker.uploadPhase}
    />
  );
}
