import { FilePenLine, History } from 'lucide-react';
import {
  Select as StudioSelect,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';
import type React from 'react';

import type { useContentDetail } from '../../hooks/use-contents';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';

export type ContentEditorTabId = 'general' | 'history';
export type ContentEditorMode = 'create' | 'edit';
const contentEditorTabIds = ['general', 'history'] as const satisfies readonly ContentEditorTabId[];

export const normalizeContentEditorTab = (value: unknown): ContentEditorTabId =>
  typeof value === 'string' && contentEditorTabIds.includes(value as ContentEditorTabId)
    ? (value as ContentEditorTabId)
    : 'general';

export const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('content.table.notPublished');
  }

  return formatEditorDateTime(value) ?? value;
};

const historyActionLabelKey = {
  created: 'content.history.actions.created',
  updated: 'content.history.actions.updated',
  status_changed: 'content.history.actions.statusChanged',
} as const;

const resolveTabPanelBody = (
  tabId: ContentEditorTabId,
  mode: ContentEditorMode,
  history: ReturnType<typeof useContentDetail>['history'],
  renderGeneralTabPanel: () => React.JSX.Element
): React.JSX.Element => {
  if (tabId === 'general') {
    return renderGeneralTabPanel();
  }

  return renderContentHistory({ mode, history });
};

const renderContentHistory = ({
  mode,
  history,
}: {
  mode: ContentEditorMode;
  history: ReturnType<typeof useContentDetail>['history'];
}) => {
  if (mode === 'create') {
    return <p className="text-sm text-muted-foreground">{t('content.history.createHint')}</p>;
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('content.history.empty')}</p>;
  }

  return (
    <ol className="space-y-3">
      {history.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {t(historyActionLabelKey[entry.action])}
            </span>
            <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('content.history.byline', { actor: entry.actor })}
          </p>
          {entry.summary ? <p className="mt-2 text-sm text-foreground">{entry.summary}</p> : null}
          {entry.changedFields.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('content.history.changedFields', { fields: entry.changedFields.join(', ') })}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
};

const contentEditorTabIconMap = {
  general: FilePenLine,
  history: History,
} as const satisfies Record<ContentEditorTabId, typeof FilePenLine>;

const contentEditorTabLabelKeyMap = {
  general: 'content.tabs.generalTitle',
  history: 'content.history.title',
} as const satisfies Record<ContentEditorTabId, string>;

const contentEditorTabBodyKeyMap = {
  general: 'content.tabs.generalDescription',
  history: 'content.tabs.historyDescription',
} as const satisfies Record<ContentEditorTabId, string>;

type ContentEditorTabsProps = {
  readonly mode: ContentEditorMode;
  readonly history: ReturnType<typeof useContentDetail>['history'];
  readonly resolvedActiveTab: ContentEditorTabId;
  readonly visibleTabs: readonly ContentEditorTabId[];
  readonly visitedTabs: readonly ContentEditorTabId[];
  readonly handleTabChange: (tab: ContentEditorTabId) => void;
  readonly warmTab: (tab: ContentEditorTabId) => void;
  readonly renderGeneralTabPanel: () => React.JSX.Element;
};

export const ContentEditorTabs = ({
  mode,
  history,
  resolvedActiveTab,
  visibleTabs,
  visitedTabs,
  handleTabChange,
  warmTab,
  renderGeneralTabPanel,
}: ContentEditorTabsProps) => (
  <div className="space-y-4">
    <Tabs
      value={resolvedActiveTab}
      onValueChange={(value) => handleTabChange(normalizeContentEditorTab(value))}
      className="space-y-0"
    >
      <label className="block md:hidden">
        <span className="sr-only">{t('content.tabs.ariaLabel')}</span>
        <StudioSelect
          aria-label={t('content.tabs.ariaLabel')}
          className="h-11 rounded-xl border-border/70 bg-card"
          value={resolvedActiveTab}
          onChange={(event) => handleTabChange(normalizeContentEditorTab(event.target.value))}
        >
          {visibleTabs.map((tabId) => (
            <option key={tabId} value={tabId}>
              {t(contentEditorTabLabelKeyMap[tabId])}
            </option>
          ))}
        </StudioSelect>
      </label>

      <TabsList
        aria-label={t('content.tabs.ariaLabel')}
        className="ml-[10px] hidden gap-10 md:flex"
      >
        {visibleTabs.map((tabId) => {
          const TabIcon = contentEditorTabIconMap[tabId];
          const isActive = tabId === resolvedActiveTab;

          return (
            <TabsTrigger
              key={tabId}
              value={tabId}
              onMouseEnter={() => warmTab(tabId)}
              onFocus={() => warmTab(tabId)}
              className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                isActive
                  ? 'mb-[-1px] border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{t(contentEditorTabLabelKeyMap[tabId])}</span>
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {visibleTabs.map((tabId) => {
        const shouldKeepMounted = visitedTabs.includes(tabId) && tabId !== resolvedActiveTab;

        return (
          <TabsContent
            key={tabId}
            value={tabId}
            forceMount={shouldKeepMounted || undefined}
            className="mt-0 data-[state=inactive]:hidden"
          >
            <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
              <section
                aria-label={t(contentEditorTabLabelKeyMap[tabId])}
                className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {t(contentEditorTabLabelKeyMap[tabId])}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(contentEditorTabBodyKeyMap[tabId])}
                  </p>
                </div>
              </section>

              {resolveTabPanelBody(tabId, mode, history, renderGeneralTabPanel)}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  </div>
);
