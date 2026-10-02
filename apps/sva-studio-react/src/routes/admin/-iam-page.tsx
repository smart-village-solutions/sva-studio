import { Button, StudioPageTitle } from '@sva/studio-ui-react';

import { useNavigate } from '@tanstack/react-router';

import React from 'react';

import {
  createStudioDataTableLabels,
  createStudioDataTableSortingLabels,
} from '../../components/studio-data-table-labels';

import { Alert, AlertDescription } from '../../components/ui/alert';

import { Card } from '../../components/ui/card';

import {
  getAllowedIamCockpitTabs,
  hasGovernanceComplianceExportRole,
  hasIamCockpitAccessRole,
  isIamCockpitEnabled,
  type IamCockpitTabKey,
} from '../../lib/iam-viewer-access';

import { t } from '../../i18n';

import { useEffectiveAccess, useEffectiveAuth } from '../../providers/effective-access-provider';

import { buildDsrColumns, buildGovernanceColumns } from './-iam-page-case-columns';
import { DeletionRulesTabPanel, useDeletionRulesTabState } from './-iam-page-deletion-rules';
import { DsrTabPanel, useDsrTabState } from './-iam-page-dsr';
import { GovernanceTabPanel, useGovernanceTabState } from './-iam-page-governance';
import { RightsTabPanel } from './-iam-page-rights-panel';
import { useRightsTabState } from './-iam-page-rights-state';
import type { IamViewerPageProps } from './-iam-page-shared';
import { getActiveTabHelp, getTabId, getTabPanelId } from './-iam-page-shared';
import { getFirstAllowedTab, mapIamTabToTranslationKey } from './-iam.models';

const useIamTabNavigation = (
  activeTab: IamCockpitTabKey,
  allowedTabs: readonly IamCockpitTabKey[]
) => {
  const navigate = useNavigate();
  const tabButtonRefs = React.useRef<Partial<Record<IamCockpitTabKey, HTMLButtonElement | null>>>(
    {}
  );
  const shouldFocusActiveTabRef = React.useRef(false);

  const navigateToTab = React.useCallback(
    (tab: IamCockpitTabKey, focusActiveTab = false) => {
      shouldFocusActiveTabRef.current = focusActiveTab;
      Promise.resolve(navigate({ to: '/admin/iam', search: { tab } })).catch(() => undefined);
    },
    [navigate]
  );

  React.useEffect(() => {
    if (allowedTabs.length === 0 || allowedTabs.includes(activeTab)) {
      return;
    }
    shouldFocusActiveTabRef.current = false;
    Promise.resolve(
      navigate({
        to: '/admin/iam',
        search: { tab: getFirstAllowedTab(allowedTabs) },
        replace: true,
      })
    ).catch(() => undefined);
  }, [activeTab, allowedTabs, navigate]);

  React.useEffect(() => {
    if (!shouldFocusActiveTabRef.current) {
      return;
    }
    const activeButton = tabButtonRefs.current[activeTab];
    if (!activeButton) {
      return;
    }
    shouldFocusActiveTabRef.current = false;
    activeButton.focus();
  }, [activeTab]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (event.key === 'Home') {
      navigateToTab(allowedTabs[0] ?? 'rights', true);
      return;
    }
    if (event.key === 'End') {
      navigateToTab(allowedTabs[allowedTabs.length - 1] ?? 'rights', true);
      return;
    }

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (tabIndex + direction + allowedTabs.length) % allowedTabs.length;
    navigateToTab(allowedTabs[nextIndex] ?? 'rights', true);
  };

  return {
    handleTabKeyDown,
    navigateToTab,
    tabButtonRefs,
  };
};

const ActiveTabHelpCard = ({ activeTab }: Readonly<{ activeTab: IamCockpitTabKey }>) => {
  const activeTabHelp = React.useMemo(() => getActiveTabHelp(activeTab), [activeTab]);

  return (
    <Card className="border-border/80 bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{activeTabHelp.title}</p>
        <p className="text-sm text-muted-foreground">{activeTabHelp.description}</p>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('admin.iam.tabHelp.optionsLabel')}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {activeTabHelp.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
};

export function IamViewerPage({ activeTab }: IamViewerPageProps) {
  const { user, isLoading: isLoadingUser, error: authError } = useEffectiveAuth();
  const { invalidate } = useEffectiveAccess();
  const invalidateEffectiveAccess = React.useCallback(async () => invalidate(), [invalidate]);
  const instanceId = user?.instanceId ?? '';
  const cockpitEnabled = isIamCockpitEnabled();
  const canAccessCockpit = hasIamCockpitAccessRole(user);
  const canExportGovernanceCompliance = hasGovernanceComplianceExportRole(user);
  const allowedTabs = React.useMemo(() => getAllowedIamCockpitTabs(user), [user]);
  const studioDataTableLabels = React.useMemo(() => createStudioDataTableLabels(), []);
  const studioDataTableSortingLabels = React.useMemo(
    () => createStudioDataTableSortingLabels(),
    []
  );
  const { handleTabKeyDown, navigateToTab, tabButtonRefs } = useIamTabNavigation(
    activeTab,
    allowedTabs
  );
  const rightsTabState = useRightsTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
    instanceId,
    refreshSession: invalidateEffectiveAccess,
  });
  const governanceTabState = useGovernanceTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
  });
  const dsrTabState = useDsrTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
  });
  const deletionRulesTabState = useDeletionRulesTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
    instanceId,
  });
  const governanceColumns = React.useMemo(buildGovernanceColumns, []);
  const dsrColumns = React.useMemo(buildDsrColumns, []);

  if (isLoadingUser) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.messages.initializing')}</p>;
  }

  if (authError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{authError.message}</AlertDescription>
      </Alert>
    );
  }

  if (!cockpitEnabled) {
    return (
      <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
        <AlertDescription>{t('admin.iam.messages.disabled')}</AlertDescription>
      </Alert>
    );
  }

  if (!canAccessCockpit || allowedTabs.length === 0) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{t('admin.iam.messages.forbidden')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <StudioPageTitle withAccessory>{t('admin.iam.page.title')}</StudioPageTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.iam.page.subtitle')}</p>
      </header>

      <Card
        className="flex flex-wrap gap-2 p-2"
        role="tablist"
        aria-label={t('admin.iam.tabs.ariaLabel')}
      >
        {allowedTabs.map((tab, tabIndex) => {
          const selected = tab === activeTab;
          return (
            <Button
              key={tab}
              ref={(element) => {
                tabButtonRefs.current[tab] = element;
              }}
              type="button"
              id={getTabId(tab)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-controls={getTabPanelId(tab)}
              aria-selected={selected}
              className={selected ? 'font-semibold' : 'text-muted-foreground'}
              onClick={() => navigateToTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
              variant={selected ? 'primary' : 'tertiary'}
            >
              {t(mapIamTabToTranslationKey(tab))}
            </Button>
          );
        })}
      </Card>

      <ActiveTabHelpCard activeTab={activeTab} />

      {activeTab === 'rights' ? (
        <RightsTabPanel
          panelId={getTabPanelId('rights')}
          labelledBy={getTabId('rights')}
          state={rightsTabState}
        />
      ) : null}

      {activeTab === 'governance' ? (
        <GovernanceTabPanel
          canExportGovernanceCompliance={canExportGovernanceCompliance}
          instanceId={instanceId}
          panelId={getTabPanelId('governance')}
          labelledBy={getTabId('governance')}
          state={governanceTabState}
          columns={governanceColumns}
          labels={studioDataTableLabels}
          sortingLabels={studioDataTableSortingLabels}
        />
      ) : null}

      {activeTab === 'dsr' ? (
        <DsrTabPanel
          panelId={getTabPanelId('dsr')}
          labelledBy={getTabId('dsr')}
          state={dsrTabState}
          columns={dsrColumns}
          labels={studioDataTableLabels}
          sortingLabels={studioDataTableSortingLabels}
        />
      ) : null}

      {activeTab === 'deletion-rules' ? (
        <DeletionRulesTabPanel
          panelId={getTabPanelId('deletion-rules')}
          labelledBy={getTabId('deletion-rules')}
          state={deletionRulesTabState}
        />
      ) : null}
    </section>
  );
}
