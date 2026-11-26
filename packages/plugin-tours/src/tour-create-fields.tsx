import {
  getHostMediaAssetPersistentUrl,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  requestMainserverJson,
  type usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Input,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  RichTextHtmlEditor,
  StudioDetailCard,
  StudioField,
  Textarea,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';

type Translate = ReturnType<typeof usePluginTranslation>;
type Principal = MainserverPrincipalControlModel['value'];

function TourDescription({ pt, disabled }: { pt: Translate; disabled: boolean }) {
  const [description, setDescription] = useState('');
  return (
    <div className="space-y-2">
      <p id="tour-description-label" className="text-sm font-medium">
        {pt('tourDescription')}
      </p>
      <input name="description" type="hidden" value={description} />
      <RichTextHtmlEditor
        id="tour-description"
        labelId="tour-description-label"
        value={description}
        onChange={setDescription}
        disabled={disabled}
        blockTypeOptions={[
          { value: 'paragraph', label: pt('richText.paragraph') },
          { value: 'heading-2', label: pt('richText.heading') },
        ]}
        toolbarLabels={{
          mode: pt('richText.mode'),
          visualMode: pt('richText.visual'),
          htmlMode: pt('richText.html'),
          blockType: pt('richText.blockType'),
          bulletList: pt('richText.bullets'),
          orderedList: pt('richText.numbered'),
          bold: pt('richText.bold'),
          italic: pt('richText.italic'),
          underline: pt('richText.underline'),
          clearFormatting: pt('richText.clear'),
          undo: pt('richText.undo'),
          redo: pt('richText.redo'),
          link: pt('richText.link'),
          linkPrompt: pt('richText.linkPrompt'),
        }}
      />
    </div>
  );
}

function TourCategoryField({ pt }: { pt: Translate }) {
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    void requestMainserverJson<{ data: readonly { id: string; name: string }[] }>({
      url: '/api/v1/mainserver/categories?dataType=tour',
      init: { signal: abort.signal },
    }).then(
      ({ data }) => {
        if (!abort.signal.aborted) setCategories(data);
      },
      () => undefined
    );
    return () => abort.abort();
  }, []);
  return (
    <StudioField id="tour-category" label={pt('categories')}>
      <select
        id="tour-category"
        name="category"
        className="min-h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="">{pt('unknown')}</option>
        {categories.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </StudioField>
  );
}

export function TourBasisFields({
  pt,
  busy,
  principal,
  principalControl,
}: {
  pt: Translate;
  busy: boolean;
  principal: Principal;
  principalControl?: MainserverPrincipalControlModel;
}) {
  return (
    <StudioDetailCard title={pt('basis')}>
      <MainserverPrincipalControl
        id="tour-principal"
        label={pt('principal')}
        value={principal}
        onChange={() => undefined}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: 'user',
          label: pt('personal'),
        }).filter(({ value }) => value === principal)}
        readinessByPrincipal={principalControl?.readinessByPrincipal}
        readinessMessage={principalControl?.readinessMessage}
      />
      <StudioField id="tour-name" label={pt('name')}>
        <Input id="tour-name" name="name" required maxLength={250} />
      </StudioField>
      <StudioField id="tour-length" label={pt('length')}>
        <Input
          id="tour-length"
          name="length"
          required
          type="number"
          min={0}
          max={2147483647}
          step={1}
        />
      </StudioField>
      <TourDescription pt={pt} disabled={busy} />
      <TourCategoryField pt={pt} />
      <div className="grid gap-3 sm:grid-cols-3">
        {(['operator', 'email', 'phone'] as const).map((name) => (
          <StudioField key={name} id={`tour-${name}`} label={pt(name)}>
            <Input
              id={`tour-${name}`}
              name={name}
              type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
              maxLength={250}
            />
          </StudioField>
        ))}
      </div>
    </StudioDetailCard>
  );
}

export function TourRouteFields({ pt }: { pt: Translate }) {
  return (
    <StudioDetailCard title={pt('routeAndLocation')}>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['street', 'zip', 'city'] as const).map((name) => (
          <StudioField key={name} id={`tour-${name}`} label={pt(name)}>
            <Input id={`tour-${name}`} name={name} maxLength={250} />
          </StudioField>
        ))}
      </div>
      <StudioField id="tour-route" label={pt('route')}>
        <Textarea id="tour-route" name="route" aria-describedby="tour-route-hint" />
      </StudioField>
      <p id="tour-route-hint" className="text-sm text-muted-foreground">
        {pt('routeHint')}
      </p>
    </StudioDetailCard>
  );
}

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
