import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceFile = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), '../..', relativePath), 'utf8');

const count = (source: string, needle: string): number => source.split(needle).length - 1;

const editors = [
  {
    name: 'News',
    panel: 'packages/plugin-news/src/news.detail-basis-tab.tsx',
    actions: 'packages/plugin-news/src/news.detail-page.tsx',
  },
  {
    name: 'Events',
    panel: 'packages/plugin-events/src/events.detail-page.tsx',
    actions: 'packages/plugin-events/src/events.detail-page.tsx',
  },
  {
    name: 'POI',
    panel: 'packages/plugin-poi/src/poi.detail-page.tsx',
    actions: 'packages/plugin-poi/src/poi.detail-page.tsx',
  },
  {
    name: 'Generic Items',
    panel: 'packages/plugin-generic-items/src/generic-items.detail-page.tabs.tsx',
    actions: 'packages/plugin-generic-items/src/generic-items.detail-page.tsx',
  },
  {
    name: 'FAQ',
    panel: 'packages/plugin-faq/src/faq.editor-tabs.tsx',
    actions: 'packages/plugin-faq/src/faq-editor-view.tsx',
  },
  {
    name: 'Cockpit Cards',
    panel: 'packages/plugin-cockpit-cards/src/cockpit-cards.pages.tsx',
    actions: 'packages/plugin-cockpit-cards/src/cockpit-cards.pages.tsx',
  },
  {
    name: 'Featured Projects',
    panel: 'packages/plugin-projects/src/projects.pages.tsx',
    actions: 'packages/plugin-projects/src/projects.pages.tsx',
  },
  {
    name: 'Surveys',
    panel: 'packages/plugin-surveys/src/surveys.editor-tabs.tsx',
    actions: 'packages/plugin-surveys/src/surveys.editor.actions.tsx',
  },
] as const;

describe('content ownership editor conformance', () => {
  for (const editor of editors) {
    it(`${editor.name} registers exactly one first-tab panel and one save hint`, () => {
      const panelSource = workspaceFile(editor.panel);
      const actionSource = workspaceFile(editor.actions);

      expect(count(panelSource, '<ContentOwnershipPanelSlot />')).toBe(1);
      expect(count(actionSource, '<ContentOwnershipSaveHint />')).toBe(1);
    });
  }

  it('keeps transfer activation dependent on server capability and effective authorization', () => {
    const boundary = workspaceFile('apps/sva-studio-react/src/routing/app-route-bindings.tsx');

    expect(boundary).toMatch(
      /enabledActions\.includes\(\s*'content\.transferOwnership'\s*\)/u
    );
    expect(boundary).toContain('supported={transferSupported && transferCapabilityConfirmed}');
    expect(boundary).toContain('canTransfer={transferAuthorized}');
  });
});
