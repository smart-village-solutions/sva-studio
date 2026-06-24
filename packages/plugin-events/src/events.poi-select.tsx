import * as React from 'react';
import { Button, Input } from '@sva/studio-ui-react';

import type { PoiSelectItem } from './events.types.js';

export type EventsPoiSelectProps = Readonly<{
  availablePois: readonly PoiSelectItem[];
  clearLabel: string;
  emptyText: string;
  errorMessage?: string;
  inputId?: string;
  inputPlaceholder: string;
  loading: boolean;
  loadingText: string;
  onChange: (value: string) => void;
  searchLabel: string;
  value: string;
}>;

const normalizeText = (value: string) => value.trim().toLocaleLowerCase();

export function EventsPoiSelect({
  availablePois,
  clearLabel,
  emptyText,
  errorMessage,
  inputId,
  inputPlaceholder,
  loading,
  loadingText,
  onChange,
  searchLabel,
  value,
}: EventsPoiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const selectedPoi = availablePois.find((poi) => poi.id === value) ?? null;

  React.useEffect(() => {
    setQuery(selectedPoi?.name ?? '');
  }, [selectedPoi?.name]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node) === false) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredPois = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery.length === 0) {
      return availablePois.slice(0, 50);
    }

    return availablePois.filter((poi) => normalizeText(poi.name).includes(normalizedQuery)).slice(0, 50);
  }, [availablePois, query]);

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="flex gap-2">
        <Input
          id={inputId}
          aria-label={searchLabel}
          placeholder={inputPlaceholder}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setIsOpen(true);
            if (value) {
              onChange('');
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!value && query.trim().length === 0}
          onClick={() => {
            setQuery('');
            setIsOpen(false);
            onChange('');
          }}
        >
          {clearLabel}
        </Button>
      </div>

      <p className="text-sm text-foreground">{loading ? loadingText : selectedPoi ? selectedPoi.id : ''}</p>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {isOpen ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-2 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{loadingText}</p>
          ) : filteredPois.length > 0 ? (
            <div className="space-y-1">
              {filteredPois.map((poi) => (
                <button
                  key={poi.id}
                  type="button"
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(poi.id);
                    setQuery(poi.name);
                    setIsOpen(false);
                  }}
                >
                  <span className="font-medium text-foreground">{poi.name}</span>
                  <span className="text-xs text-muted-foreground">{poi.id}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
