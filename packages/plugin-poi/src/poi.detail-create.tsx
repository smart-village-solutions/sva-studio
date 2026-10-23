/**
 * Komponiert die Neuanlage für Orte als durchgehendes Formular.
 * Bestehende Feldabschnitte verwalten ihre Eingaben; der bestehende Editor behält den Submit.
 */
import type { ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { StudioSection } from '@sva/studio-ui-react';
import { PoiDetailBasisTab } from './poi.detail-basis-tab.js';
import { PoiDetailAdvancedTab } from './poi.detail-advanced-tab.js';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';

export function PoiDetailCreate({
  view,
  content,
}: Readonly<{ view: PoiDetailPageViewModel; content: ReactNode }>) {
  const { pt, methods } = view;
  const active = useWatch({ control: methods.control, name: 'basis.active' });
  const externalId = useWatch({ control: methods.control, name: 'settings.externalId' });
  const nav = [
    'name',
    'location',
    'description',
    'media',
    'categories',
    'openingHours',
    'contact',
    'links',
    'prices',
    'operator',
    'technical',
    'active',
  ] as const;
  const basisProps = { ...view, availableCategories: view.categoryOptions };
  return (
    <div className="space-y-6">
      <p>{pt('create.intro')}</p>
      <nav aria-label={pt('create.navigation')} className="flex flex-wrap gap-3">
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
        <StudioSection description={pt(active ? 'create.activeEffect' : 'create.inactiveEffect')}>
          <p>{pt('create.editHint')}</p>
        </StudioSection>
      </div>
    </div>
  );
}
