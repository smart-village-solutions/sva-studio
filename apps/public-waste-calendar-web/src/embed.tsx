import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { PublicWasteApiOriginContext } from './lib/public-waste-api-context.js';
import { isPublicWasteUuid } from './lib/public-waste-contract.js';
import { createPublicWasteTranslator } from './lib/public-waste-translations.js';
import { PublicWasteIndexPage, readPublicWasteRegionBinding } from './routes/index.js';
import type { PublicWasteRegionBinding } from './routes/public-waste-index-binding.js';
import styles from './styles.css?inline';

const mountedCalendars = new WeakMap<HTMLElement, Root>();

export const mountPublicWasteCalendar = (container: HTMLElement, apiOrigin: string): Root => {
  const existing = mountedCalendars.get(container);
  if (existing) return existing;
  const origin = new URL(apiOrigin);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) {
    throw new Error('invalid_public_waste_api_origin');
  }
  const region = container.dataset.region?.trim();
  let binding: PublicWasteRegionBinding = { status: 'unbound' };
  if (region !== undefined) {
    binding = isPublicWasteUuid(region)
      ? readPublicWasteRegionBinding(`?regionId=${encodeURIComponent(region)}`)
      : region
        ? readPublicWasteRegionBinding('', `/${encodeURIComponent(region)}`)
        : { status: 'invalid' };
  }
  const shadow = container.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    styles.replace(':root', ':host') +
    '\n:host { display: block; line-height: 1.5; text-align: start; }';
  const mount = document.createElement('div');
  mount.className = 'page-shell';
  mount.lang = document.documentElement.lang || 'de';
  mount.setAttribute('role', 'region');
  mount.setAttribute('aria-label', createPublicWasteTranslator(mount.lang)('calendar.title'));
  shadow.append(style, mount);
  const root = createRoot(mount);
  mountedCalendars.set(container, root);
  root.render(
    <PublicWasteApiOriginContext.Provider value={origin.origin}>
      <PublicWasteIndexPage binding={binding} embedded />
    </PublicWasteApiOriginContext.Provider>
  );
  return root;
};

for (const container of document.querySelectorAll<HTMLElement>('[data-public-waste-calendar]')) {
  mountPublicWasteCalendar(container, new URL(import.meta.url).origin);
}
