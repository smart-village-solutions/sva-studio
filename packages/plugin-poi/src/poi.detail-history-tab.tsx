import { StudioEmptyState } from '@sva/studio-ui-react';

export function PoiDetailHistoryTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  return (
    <StudioEmptyState>
      <div className="space-y-2">
        <p className="font-medium text-foreground">{pt('history.empty.title')}</p>
        <p>{pt('history.empty.description')}</p>
      </div>
    </StudioEmptyState>
  );
}
