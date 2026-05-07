export const resources = {
  de: {
    app: {
      title: 'SVA Studio Projektdashboard',
      subtitle:
        'Entwicklungsstand für das SVA Studio. Transparent. Immer aktuell.',
      updatedAt: 'Stand',
      source: 'Quelle',
      emptyState: 'Für die aktuellen Filter gibt es keine Einträge.',
      tabs: {
        milestones: 'Meilensteine',
        workPackages: 'Arbeitspakete',
      },
      filters: {
        search: 'Suche',
        searchPlaceholder: 'Nach ID, Titel, Bereich oder Meilenstein suchen',
        milestone: 'Meilenstein',
        status: 'Status',
        health: 'Warnstufe',
        priority: 'Priorität',
      },
      milestone: {
        estimatedEffort: 'Geschätzter Aufwand',
        workPackages: 'Arbeitspakete',
        progress: 'Fortschritt',
      },
      workPackageTable: {
        id: 'ID',
        title: 'Arbeitspaket',
        milestone: 'Meilenstein',
        priority: 'Priorität',
        status: 'Status',
        health: 'Warnstufe',
        effort: 'PT',
        progress: 'Fortschritt',
      },
      statuses: {
        idea: 'Idee',
        commissioned: 'Beauftragt',
        planned: 'Geplant',
        prototype: 'Prototyp',
        implementation: 'Umsetzung',
        optimization: 'Optimierung',
        testing: 'Interne QS',
        acceptance: 'Abnahme',
        done: 'Fertig',
      },
    },
  },
} as const;

type LeafValue = string | number;

const readLeaf = (path: string): LeafValue => {
  const segments = path.split('.');
  let current: unknown = resources.de;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      throw new Error(`Missing translation key: ${path}`);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current !== 'string' && typeof current !== 'number') {
    throw new Error(`Translation key does not resolve to a leaf value: ${path}`);
  }

  return current;
};

export const t = (path: string) => String(readLeaf(path));
