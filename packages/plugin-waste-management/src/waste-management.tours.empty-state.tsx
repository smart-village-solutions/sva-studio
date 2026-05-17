import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

export const WasteToursEmptyState = ({ onOpenCreateDialog }: { readonly onOpenCreateDialog: () => void }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('tours.messages.emptyTitle')}</p>
        <p>{pt('tours.messages.emptyBody')}</p>
        <div className="pt-2">
          <Button type="button" onClick={onOpenCreateDialog}>
            {pt('tours.actions.openCreate')}
          </Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};
