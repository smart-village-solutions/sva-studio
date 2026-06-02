import * as React from 'react';

import { t } from '../lib/i18n';

export const ProgressBar = ({ value }: Readonly<{ value: number }>) => (
  <div
    className="progress-shell"
    style={{ '--progress-width': value } as React.CSSProperties & { '--progress-width': number }}
    aria-label={`${t('app.milestone.progress')}: ${value}%`}
  />
);
