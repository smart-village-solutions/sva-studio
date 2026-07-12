import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { IconEdit, IconTrash } from '@tabler/icons-react';

export const FractionRowActions = ({
  fraction,
  onOpenEditFraction,
  onRequestDeleteFraction,
}: {
  readonly fraction: WasteFractionRecord;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onRequestDeleteFraction: (fraction: WasteFractionRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
        aria-label={pt('masterData.fractions.actions.edit')}
        onClick={() => onOpenEditFraction(fraction)}
      >
        <IconEdit aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
        aria-label={pt('masterData.fractions.actions.delete')}
        onClick={() => onRequestDeleteFraction(fraction)}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
      </Button>
    </>
  );
};
