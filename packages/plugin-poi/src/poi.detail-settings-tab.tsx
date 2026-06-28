import { PoiDetailAdvancedTab } from './poi.detail-advanced-tab.js';

export function PoiDetailSettingsTab({
  pt,
}: Readonly<{
  pt: (key: string) => string;
}>) {
  return (
    <div className="space-y-6">
      <PoiDetailAdvancedTab pt={pt} />
    </div>
  );
}
