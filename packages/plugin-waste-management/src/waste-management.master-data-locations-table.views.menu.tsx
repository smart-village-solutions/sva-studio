import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  IconBuildingCommunity,
  IconChevronDown,
  IconHome,
  IconMapPin,
  IconPlus,
  IconRoute,
} from '@tabler/icons-react';
import { Button } from '@sva/studio-ui-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type WasteLocationsCreateMenuProps = Readonly<{
  onOpenCreateRegion: () => void;
  onOpenCreateCity: () => void;
  onOpenCreateStreet: () => void;
  onOpenCreateHouseNumber: () => void;
  onOpenCreateLocation: () => void;
}>;

type CreateMenuItem = Readonly<{
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: () => void;
}>;

const useWasteLocationsCreateMenuItems = ({
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
}: WasteLocationsCreateMenuProps): readonly CreateMenuItem[] => {
  const pt = usePluginTranslation('wasteManagement');
  return [
    {
      id: 'create-region',
      title: pt('masterData.locationsWorkspace.actions.createRegion'),
      description: pt('masterData.locationsWorkspace.actions.createRegionHint'),
      icon: <IconBuildingCommunity aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateRegion,
    },
    {
      id: 'create-city',
      title: pt('masterData.locationsWorkspace.actions.createCity'),
      description: pt('masterData.locationsWorkspace.actions.createCityHint'),
      icon: <IconHome aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateCity,
    },
    {
      id: 'create-street',
      title: pt('masterData.locationsWorkspace.actions.createStreet'),
      description: pt('masterData.locationsWorkspace.actions.createStreetHint'),
      icon: <IconRoute aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateStreet,
    },
    {
      id: 'create-house-number',
      title: pt('masterData.locationsWorkspace.actions.createHouseNumber'),
      description: pt('masterData.houseNumbers.description'),
      icon: <IconHome aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateHouseNumber,
    },
    {
      id: 'create-location',
      title: pt('masterData.locationsWorkspace.actions.createLocation'),
      description: pt('masterData.locationsWorkspace.actions.createLocationHint'),
      icon: <IconMapPin aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateLocation,
    },
  ];
};

const WasteLocationsCreateMenuList = ({
  menuId,
  items,
  onClose,
}: {
  readonly menuId: string;
  readonly items: readonly CreateMenuItem[];
  readonly onClose: () => void;
}) => (
  <div
    id={menuId}
    role="menu"
    aria-orientation="vertical"
    className="absolute right-0 top-full z-50 mt-2 min-w-64 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-md"
  >
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
        onClick={() => {
          onClose();
          item.onSelect();
        }}
      >
        <span className="mt-0.5 text-muted-foreground">{item.icon}</span>
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">{item.title}</span>
          <span className="block text-xs text-muted-foreground">{item.description}</span>
        </span>
      </button>
    ))}
  </div>
);

export const WasteLocationsCreateMenu = ({
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
}: WasteLocationsCreateMenuProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const items = useWasteLocationsCreateMenuItems({
    onOpenCreateRegion,
    onOpenCreateCity,
    onOpenCreateStreet,
    onOpenCreateHouseNumber,
    onOpenCreateLocation,
  });

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="h-10 rounded-lg px-3"
        onClick={() => setOpen((current) => !current)}
      >
        <IconPlus aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.actions.createMenu')}
        <IconChevronDown aria-hidden="true" className="h-4 w-4 opacity-80" />
      </Button>
      {open ? (
        <WasteLocationsCreateMenuList
          menuId={menuId}
          items={items}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
};
