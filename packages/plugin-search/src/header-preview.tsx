import { Search, SendHorizontal } from 'lucide-react';
import { Input } from '@sva/studio-ui-react';

/** Existing Studio header presentation, retained for the future Search plugin. */
export const SearchHeaderPreview = ({ label }: { readonly label: string }) => (
  <div className="relative min-w-0 flex-1">
    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">
      <Search className="h-4 w-4" />
    </span>
    <Input
      type="text"
      value={label}
      readOnly
      disabled
      aria-label={label}
      className="h-11 rounded-full border-border bg-surface-inset pl-11 pr-11 text-sm text-muted-foreground disabled:bg-surface-inset disabled:text-muted-foreground disabled:opacity-100"
    />
    <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">
      <SendHorizontal className="h-4 w-4" />
    </span>
  </div>
);
