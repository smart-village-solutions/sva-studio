export const studioTableDEResources = {
  columns: {
    actions: 'Aktionen',
    selection: 'Auswahl',
  },
  selection: {
    selectAll: '{{label}}: Alle Zeilen auswählen',
    selectRow: '{{label}}: Zeile auswählen',
    selectRowById: '{{label}}: Zeile {{rowId}} auswählen',
  },
  sorting: {
    field: 'Sortierfeld',
    direction: 'Sortierrichtung',
    none: 'Keine Sortierung',
    ascending: 'Aufsteigend',
    descending: 'Absteigend',
  },
  status: {
    loading: 'Tabelle wird geladen.',
  },
} as const;
