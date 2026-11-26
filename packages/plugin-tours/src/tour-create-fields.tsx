import { requestMainserverJson, type usePluginTranslation } from '@sva/plugin-sdk';
import {
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

type TourDescriptionProps = {
  pt: Translate;
  disabled: boolean;
  onChange: () => void;
  initialDescription?: string | null;
};

function TourDescription({ pt, disabled, onChange, initialDescription }: TourDescriptionProps) {
  const [description, setDescription] = useState(initialDescription ?? '');
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
        onChange={(nextDescription) => {
          setDescription(nextDescription);
          onChange();
        }}
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
  onDescriptionChange,
  existing,
}: {
  pt: Translate;
  busy: boolean;
  principal: Principal;
  principalControl?: MainserverPrincipalControlModel;
  onDescriptionChange: () => void;
  existing?: { name: string | null; lengthKm: number | null; description: string | null };
}) {
  return (
    <StudioDetailCard title={pt('basis')}>
      <MainserverPrincipalControl
        id="tour-principal"
        label={pt(existing ? 'editPrincipal' : 'principal')}
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
        <Input
          id="tour-name"
          name="name"
          required={!existing || existing.name !== null}
          maxLength={250}
          defaultValue={existing?.name ?? undefined}
        />
      </StudioField>
      <StudioField id="tour-length" label={pt('length')}>
        <Input
          id="tour-length"
          name="length"
          required={!existing || existing.lengthKm !== null}
          type="number"
          min={0}
          max={2147483647}
          step={1}
          defaultValue={existing?.lengthKm ?? undefined}
        />
      </StudioField>
      <TourDescription
        pt={pt}
        disabled={busy}
        onChange={onDescriptionChange}
        initialDescription={existing?.description}
      />
      {!existing && <TourCreateMetadata pt={pt} />}
    </StudioDetailCard>
  );
}

function TourCreateMetadata({ pt }: { pt: Translate }) {
  return (
    <>
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
    </>
  );
}

export function TourRouteFields({ pt, initialRoute }: { pt: Translate; initialRoute?: string }) {
  return (
    <StudioDetailCard title={pt(initialRoute === undefined ? 'routeAndLocation' : 'route')}>
      {initialRoute === undefined && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(['street', 'zip', 'city'] as const).map((name) => (
            <StudioField key={name} id={`tour-${name}`} label={pt(name)}>
              <Input id={`tour-${name}`} name={name} maxLength={250} />
            </StudioField>
          ))}
        </div>
      )}
      <StudioField id="tour-route" label={pt('route')}>
        <Textarea
          id="tour-route"
          name="route"
          aria-describedby="tour-route-hint"
          defaultValue={initialRoute}
        />
      </StudioField>
      <p id="tour-route-hint" className="text-sm text-muted-foreground">
        {pt('routeHint')}
      </p>
    </StudioDetailCard>
  );
}
