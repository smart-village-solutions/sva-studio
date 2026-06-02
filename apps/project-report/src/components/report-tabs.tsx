import type { ReportView } from '../lib/url-state';
import { t } from '../lib/i18n';

const viewTabs: readonly { value: ReportView; label: string }[] = [
  { value: 'milestones', label: t('app.tabs.milestones') },
  { value: 'work-packages', label: t('app.tabs.workPackages') },
] as const;

export const ReportTabs = ({
  selectedView,
  onChange,
}: Readonly<{
  selectedView: ReportView;
  onChange: (view: ReportView) => void;
}>) => (
  <div className="tabs" role="tablist" aria-label={t('app.title')}>
    {viewTabs.map((tab) => {
      const selected = selectedView === tab.value;

      return (
        <button
          key={tab.value}
          className={selected ? 'tab-button tab-button--active' : 'tab-button'}
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);
