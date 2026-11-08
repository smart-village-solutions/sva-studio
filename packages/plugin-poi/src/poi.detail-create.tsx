/**
 * Komponiert die Neuanlage für Orte als durchgehendes Formular.
 * Bestehende Feldabschnitte verwalten ihre Eingaben; der bestehende Editor behält den Submit.
 */
import type { ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { PoiDetailBasisTab } from './poi.detail-basis-tab.js';
import { PoiDetailAdvancedTab } from './poi.detail-advanced-tab.js';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';

export function PoiDetailCreate({
  view,
  content,
}: Readonly<{ view: PoiDetailPageViewModel; content: ReactNode }>) {
  const { pt, methods } = view;
  const externalId = useWatch({ control: methods.control, name: 'settings.externalId' });
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
      <details>
        <summary id="poi-create-technical">
          {pt('create.sections.technical')} · {pt('create.optional')} ·{' '}
          {pt(externalId?.trim() ? 'create.filled' : 'create.empty')}
        </summary>
        <PoiDetailAdvancedTab pt={pt} />
      </details>
      <div id="poi-create-active" tabIndex={-1}>
        <PoiDetailBasisTab {...basisProps} section="active" />
      </div>
    </div>
  );
}
