import { type StudioDataTableLabels } from '@sva/studio-ui-react';

import { t } from '../i18n';

export const createStudioDataTableLabels = (): StudioDataTableLabels => ({
  selectionColumn: t('studioTable.columns.selection'),
  actionsColumn: t('studioTable.columns.actions'),
  loading: t('studioTable.status.loading'),
  selectAllRows: (label) => t('studioTable.selection.selectAll', { label }),
  selectRow: ({ label, rowId }) => t('studioTable.selection.selectRowById', { label, rowId }),
  selectMobileRow: ({ label, rowId }) => t('studioTable.selection.selectRowById', { label, rowId }),
});
