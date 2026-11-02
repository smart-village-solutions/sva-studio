import { Bell } from 'lucide-react';
import { Button } from '@sva/studio-ui-react';

/** Existing Studio header presentation, retained for the future Notifications plugin. */
export const NotificationsHeaderPreview = ({ label }: { readonly label: string }) => (
  <Button
    type="button"
    variant="tertiary"
    size="icon"
    tooltip={label}
    aria-label={label}
    disabled
    className="h-11 w-11 rounded-full border border-transparent bg-transparent px-0 text-muted-foreground shadow-none"
  >
    <Bell className="h-4 w-4" />
  </Button>
);
