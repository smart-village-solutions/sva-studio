import { IconEdit } from '@tabler/icons-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

export const WasteSchedulingListActionCell = ({
  ariaLabel,
  onClick,
}: {
  readonly ariaLabel: string;
  readonly onClick: () => void;
}) => (
  <td className="px-3 py-3">
    <div className="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <IconEdit aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  </td>
);

export const WasteSchedulingMissingValue = () => {
  const pt = usePluginTranslation('wasteManagement');
  return <span className="text-muted-foreground">{pt('scheduling.table.notAvailable')}</span>;
};
