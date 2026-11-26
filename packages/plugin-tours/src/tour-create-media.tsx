import {
  getHostMediaAssetPersistentUrl,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  type usePluginTranslation,
} from '@sva/plugin-sdk';
import { Button, Input, StudioDetailCard, StudioField } from '@sva/studio-ui-react';
import { useState } from 'react';

type Translate = ReturnType<typeof usePluginTranslation>;

export function TourMediaFields({ pt, instanceId }: { pt: Translate; instanceId?: string }) {
  const [image, setImage] = useState('');
  const [library, setLibrary] = useState<readonly { name: string; url: string }[] | null>(null);
  const [libraryState, setLibraryState] = useState<'loading' | 'error' | null>(null);
  const loadLibrary = async () => {
    setLibraryState('loading');
    try {
      const items = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        instanceId,
        visibility: 'public',
      });
      setLibrary(
        items.flatMap((item) => {
          const url = getHostMediaAssetPersistentUrl(item);
          return item.visibility === 'public' &&
            item.mimeType?.startsWith('image/') &&
            url?.startsWith('https://')
            ? [{ name: readHostMediaAssetFileName(item) ?? item.id, url }]
            : [];
        })
      );
      setLibraryState(null);
    } catch {
      setLibraryState('error');
    }
  };

  return (
    <StudioDetailCard title={pt('media')}>
      <StudioField id="tour-media" label={pt('imageUrl')}>
        <Input
          id="tour-media"
          name="media"
          type="url"
          pattern="https://.+"
          value={image}
          onChange={(event) => setImage(event.target.value)}
        />
      </StudioField>
      <Button
        variant="secondary"
        type="button"
        disabled={libraryState === 'loading'}
        onClick={() => void loadLibrary()}
      >
        {pt('mediaLibrary')}
      </Button>
      {libraryState === 'loading' ? <p role="status">{pt('mediaLoading')}</p> : null}
      {libraryState === 'error' ? <p role="alert">{pt('mediaError')}</p> : null}
      {library?.length === 0 ? <p>{pt('mediaEmpty')}</p> : null}
      {library && library.length > 0 ? (
        <StudioField id="tour-media-library" label={pt('mediaLibrary')}>
          <select
            id="tour-media-library"
            className="min-h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={library.some(({ url }) => url === image) ? image : ''}
            onChange={(event) => setImage(event.target.value)}
          >
            <option value="">{pt('unknown')}</option>
            {library.map(({ url, name }) => (
              <option key={url} value={url}>
                {name}
              </option>
            ))}
          </select>
        </StudioField>
      ) : null}
      <StudioField id="tour-caption" label={pt('caption')}>
        <Input id="tour-caption" name="caption" maxLength={250} />
      </StudioField>
      <StudioField id="tour-copyright" label={pt('copyright')}>
        <Input id="tour-copyright" name="copyright" maxLength={250} />
      </StudioField>
    </StudioDetailCard>
  );
}
