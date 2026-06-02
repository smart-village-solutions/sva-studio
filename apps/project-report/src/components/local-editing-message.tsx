import type { LocalEditingNotice } from '../hooks/use-local-project-status';
import { t } from '../lib/i18n';

const translationKeyByNotice: Record<LocalEditingNotice, 'app.localEditing.loading' | 'app.localEditing.active' | 'app.localEditing.loadError' | 'app.localEditing.saveError'> = {
  loading: 'app.localEditing.loading',
  active: 'app.localEditing.active',
  loadError: 'app.localEditing.loadError',
  saveError: 'app.localEditing.saveError',
};

const isErrorNotice = (notice: LocalEditingNotice) => notice === 'loadError' || notice === 'saveError';

export const LocalEditingMessage = ({ notice }: Readonly<{ notice: LocalEditingNotice | null }>) => {
  if (notice === null) {
    return null;
  }

  return (
    <p
      className={isErrorNotice(notice) ? 'panel-message panel-message--error' : 'panel-message panel-message--info'}
      role={isErrorNotice(notice) ? 'alert' : undefined}
    >
      {t(translationKeyByNotice[notice])}
    </p>
  );
};
