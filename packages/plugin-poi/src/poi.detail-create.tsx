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
  const nav = ['name', 'location', 'description', 'media', 'active'] as const;
  const basisProps = { ...view, availableCategories: view.categoryOptions };
  return (
    <div className="space-y-6">
      <p>{pt('create.intro')}</p>
      {view.categoryOptionsError ? (
        <p role="status" className="text-sm text-destructive">
          {pt('create.categoryUnavailable')}
        </p>
      ) : null}
      <nav
        aria-label={pt('create.navigation')}
        className="flex flex-wrap gap-2 text-sm [&_a]:rounded-md [&_a]:border [&_a]:border-border [&_a]:px-3 [&_a]:py-2 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline"
      >
        {nav.map((id) => (
          <a
            key={id}
            href={`#poi-create-${id}`}
            onClick={(event) => {
              const target = event.currentTarget.ownerDocument.getElementById(`poi-create-${id}`);
              if (!target) return;
              event.preventDefault();
              target.focus();
              target.scrollIntoView?.({ block: 'start' });
            }}
          >
            {pt(`create.sections.${id}`)}
          </a>
        ))}
      </nav>
      <div id="poi-create-name" tabIndex={-1}>
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
