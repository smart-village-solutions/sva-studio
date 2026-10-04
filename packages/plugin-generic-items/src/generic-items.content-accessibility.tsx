import { Button, Input, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const AccessibilityLinkRow = ({
  labels,
  index,
  urlIndex,
  webUrl,
  info,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  urlIndex: number;
  webUrl: { url: string; description: string };
  info: GenericItemsDetailFormValues['accessibilityInformations'][number];
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{labels.linkItem}</p>
        {(info.urls?.length ?? 0) > 1 ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setValue(
                `accessibilityInformations.${index}.urls`,
                (info.urls ?? []).filter((_, currentIndex) => currentIndex !== urlIndex),
                { shouldDirty: true }
              )
            }
          >
            {labels.remove}
          </Button>
        ) : null}
      </div>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-accessibility-url-${index}-${urlIndex}`} label={labels.url}>
          <Input
            id={`generic-item-accessibility-url-${index}-${urlIndex}`}
            value={webUrl.url}
            onChange={(event) =>
              setValue(
                `accessibilityInformations.${index}.urls.${urlIndex}.url`,
                event.target.value,
                {
                  shouldDirty: true,
                }
              )
            }
          />
        </StudioField>
        <StudioField
          id={`generic-item-accessibility-url-description-${index}-${urlIndex}`}
          label={labels.urlDescription}
        >
          <Input
            id={`generic-item-accessibility-url-description-${index}-${urlIndex}`}
            value={webUrl.description}
            onChange={(event) =>
              setValue(
                `accessibilityInformations.${index}.urls.${urlIndex}.description`,
                event.target.value,
                {
                  shouldDirty: true,
                }
              )
            }
          />
        </StudioField>
      </StudioFieldGroup>
    </div>
  );
};

const AccessibilityLinks = ({
  labels,
  index,
  info,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  info: GenericItemsDetailFormValues['accessibilityInformations'][number];
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  const accessibilityInformation = info;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{labels.accessibilityLinks}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            setValue(
              `accessibilityInformations.${index}.urls`,
              [...(accessibilityInformation.urls ?? []), { url: '', description: '' }],
              {
                shouldDirty: true,
              }
            )
          }
        >
          {labels.addLink}
        </Button>
      </div>
      {(accessibilityInformation.urls ?? []).map((webUrl, urlIndex) => (
        <AccessibilityLinkRow
          key={`generic-item-accessibility-url-${index}-${urlIndex}`}
          labels={labels}
          index={index}
          urlIndex={urlIndex}
          webUrl={webUrl}
          info={info}
        />
      ))}
    </div>
  );
};

const AccessibilityRow = ({
  labels,
  index,
  accessibilityInformation,
  canRemove,
  onRemove,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  accessibilityInformation: GenericItemsDetailFormValues['accessibilityInformations'][number];
  canRemove: boolean;
  onRemove: () => void;
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{labels.accessibilityInformationItem}</p>
        {canRemove ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onRemove()}>
            {labels.remove}
          </Button>
        ) : null}
      </div>
      <StudioField
        id={`generic-item-accessibility-description-${index}`}
        label={labels.description}
      >
        <Textarea
          id={`generic-item-accessibility-description-${index}`}
          value={accessibilityInformation.description}
          onChange={(event) =>
            setValue(`accessibilityInformations.${index}.description`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <StudioField
        id={`generic-item-accessibility-types-${index}`}
        label={labels.accessibilityTypes}
      >
        <Input
          id={`generic-item-accessibility-types-${index}`}
          value={accessibilityInformation.types}
          onChange={(event) =>
            setValue(`accessibilityInformations.${index}.types`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <AccessibilityLinks labels={labels} index={index} info={accessibilityInformation} />
    </div>
  );
};

export const GenericItemsContentAccessibility = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const accessibilityInformationsArray = useFieldArray({
    control,
    name: 'accessibilityInformations',
  });
  const accessibilityInformations = useWatch({ control, name: 'accessibilityInformations' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.accessibilityInformations}</p>
          <p className="text-sm text-muted-foreground">{labels.accessibilityInformationsHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            accessibilityInformationsArray.append({
              description: '',
              types: '',
              urls: [{ url: '', description: '' }],
            })
          }
        >
          {labels.addAccessibilityInformation}
        </Button>
      </div>
      {accessibilityInformations.map((accessibilityInformation, index) => (
        <AccessibilityRow
          key={
            accessibilityInformationsArray.fields[index]?.id ??
            `fallback-accessibility-information-${index}`
          }
          labels={labels}
          index={index}
          accessibilityInformation={accessibilityInformation}
          canRemove={accessibilityInformations.length > 1}
          onRemove={() => accessibilityInformationsArray.remove(index)}
        />
      ))}
    </div>
  );
};
