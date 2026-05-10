import type { WasteFractionRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';

export const WasteMasterDataFractionsContent = ({
  fractions,
  onOpenCreateFraction,
  onOpenEditFraction,
}: {
  readonly fractions: readonly WasteFractionRecord[];
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('masterData.fractions.title')}</h3>
          <p className="text-sm text-muted-foreground">{pt('masterData.fractions.description')}</p>
        </div>
        <Button type="button" onClick={onOpenCreateFraction}>
          {pt('masterData.fractions.actions.openCreate')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('masterData.meta.fractionCount', { value: fractions.length })}</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {fractions.map((fraction) => (
          <section key={fraction.id} className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">{fraction.name}</h4>
                {fraction.description ? <p className="text-sm text-muted-foreground">{fraction.description}</p> : null}
              </div>
              <Badge variant={fraction.active ? 'default' : 'secondary'}>
                {fraction.active ? pt('common.active') : pt('common.inactive')}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{pt('masterData.fractions.color', { value: fraction.color })}</Badge>
              {fraction.containerSize ? (
                <Badge variant="outline">{pt('masterData.fractions.containerSize', { value: fraction.containerSize })}</Badge>
              ) : null}
              {Object.entries(fraction.translations ?? {}).map(([locale, localizedName]) => (
                <Badge key={`${fraction.id}-${locale}`} variant="secondary">
                  {pt('masterData.fractions.translationBadge', { locale, value: localizedName })}
                </Badge>
              ))}
            </div>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenEditFraction(fraction)}>
                {pt('masterData.fractions.actions.edit')}
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
