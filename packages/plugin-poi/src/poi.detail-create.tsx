/**
 * Komponiert die Neuanlage für Orte als durchgehendes Formular.
 * Bestehende Feldabschnitte verwalten ihre Eingaben; der bestehende Editor behält den Submit.
 */
import type { ReactNode } from 'react';
import { PoiDetailBasisTab } from './poi.detail-basis-tab.js';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';

export function PoiDetailCreate({
  view,
  content,
}: Readonly<{ view: PoiDetailPageViewModel; content: ReactNode }>) {
  const { pt } = view;
  const basisProps = { ...view, availableCategories: view.categoryOptions };
  return (
    <div className="space-y-6">
      <p>{pt('create.intro')}</p>
      {view.categoryOptionsError ? (
        <p role="status" className="text-sm text-destructive">
          {pt('create.categoryUnavailable')}
        </p>
      ) : null}
      <div
        id="poi-create-name"
        tabIndex={-1}
        className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 sm:p-6"
      >
        <PoiDetailBasisTab {...basisProps} section="name" />
      </div>
      {content}
      <div id="poi-create-active" tabIndex={-1}>
        <PoiDetailBasisTab {...basisProps} section="active" />
      </div>
    </div>
  );
}
