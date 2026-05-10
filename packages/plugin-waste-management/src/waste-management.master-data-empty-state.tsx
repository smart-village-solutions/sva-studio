import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

export const WasteMasterDataEmptyState = ({
  onOpenCreateFraction,
  onOpenCreateLocation,
}: {
  readonly onOpenCreateFraction: () => void;
  readonly onOpenCreateLocation: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('masterData.messages.emptyTitle')}</p>
        <p>{pt('masterData.messages.emptyBody')}</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={onOpenCreateFraction}>{pt('masterData.fractions.actions.openCreate')}</Button>
          <Button type="button" variant="outline" onClick={onOpenCreateLocation}>{pt('masterData.collectionLocations.actions.openCreate')}</Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};
