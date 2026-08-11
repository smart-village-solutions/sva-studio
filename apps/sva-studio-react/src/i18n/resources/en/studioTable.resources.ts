export const studioTableENResources = {
  columns: {
    actions: 'Actions',
    selection: 'Selection',
  },
  selection: {
    selectAll: '{{label}}: Select all rows',
    selectRow: '{{label}}: Select row',
    selectRowById: '{{label}}: Select row {{rowId}}',
  },
  sorting: {
    field: 'Sort field',
    direction: 'Sort direction',
    none: 'No sorting',
    ascending: 'Ascending',
    descending: 'Descending',
  },
  status: {
    loading: 'Table is loading.',
  },
} as const;
