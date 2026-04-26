import React, { startTransition } from 'react';
import { useServerFn } from '@tanstack/react-start';

import { createBrowserLogger } from '@sva/monitoring-client/logging';
import type { DevelopmentLogEntry } from '@sva/server-runtime';

import { t } from '../i18n';
import { loadDevelopmentServerLogs } from '../lib/development-logs';
import {
  getBrowserDevelopmentLogs,
  startBrowserDevelopmentLogCapture,
  subscribeToBrowserDevelopmentLogs,
  type BrowserDevelopmentLogEntry,
} from '../lib/development-log-store';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Select } from './ui/select';

type LogLevelFilter = 'all' | 'debug' | 'info' | 'warn' | 'error';
type LogSourceFilter = 'all' | 'browser' | 'server';
type DevelopmentLogRecord = BrowserDevelopmentLogEntry | DevelopmentLogEntry;

const browserLogger = createBrowserLogger({
  component: 'development-log-console',
});

const isVisibleForLevel = (filter: LogLevelFilter, level: DevelopmentLogRecord['level']): boolean => {
  return filter === 'all' ? true : level === filter;
};

const isVisibleForSource = (filter: LogSourceFilter, source: DevelopmentLogRecord['source']): boolean => {
  return filter === 'all' ? true : source === filter;
};

const stringifyContext = (context: unknown): string | null => {
  if (!context) {
    return null;
  }

  try {
    return JSON.stringify(context, null, 2);
  } catch {
    if (typeof context === 'object') {
      const stringifier = context.toString;
      if (typeof stringifier === 'function' && stringifier !== Object.prototype.toString) {
        try {
          return String(context);
        } catch {
          return Object.prototype.toString.call(context);
        }
      }

      return Object.prototype.toString.call(context);
    }

    return String(context);
  }
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString();
};

const mergeServerLogs = (
  current: readonly DevelopmentLogEntry[],
  incoming: readonly DevelopmentLogEntry[]
): DevelopmentLogEntry[] => {
  const merged = new Map<number, DevelopmentLogEntry>();

  for (const entry of current) {
    merged.set(entry.id, entry);
  }

  for (const entry of incoming) {
    merged.set(entry.id, entry);
  }

  return [...merged.values()].slice(-200);
};

const applyServerLogUpdate = (
  entries: readonly DevelopmentLogEntry[],
  latestServerLogIdRef: { current: number },
  setServerLogs: React.Dispatch<React.SetStateAction<DevelopmentLogEntry[]>>
): void => {
  latestServerLogIdRef.current = entries.at(-1)?.id ?? latestServerLogIdRef.current;
  startTransition(() => {
    setServerLogs((current) => mergeServerLogs(current, entries));
  });
};

export default function DevelopmentLogConsole() {
  const loadServerLogs = useServerFn(loadDevelopmentServerLogs) as (input: {
    readonly data: {
      readonly afterId?: number;
    };
  }) => Promise<DevelopmentLogEntry[]>;
  const [isOpen, setIsOpen] = React.useState(false);
  const [levelFilter, setLevelFilter] = React.useState<LogLevelFilter>('all');
  const [sourceFilter, setSourceFilter] = React.useState<LogSourceFilter>('all');
  const [serverLogs, setServerLogs] = React.useState<DevelopmentLogEntry[]>([]);
  const [browserLogs, setBrowserLogs] = React.useState<BrowserDevelopmentLogEntry[]>([]);
  const [isDocumentVisible, setIsDocumentVisible] = React.useState(() => {
    return typeof document === 'undefined' ? true : document.visibilityState === 'visible';
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const latestServerLogIdRef = React.useRef(0);
  const inFlightRefreshRef = React.useRef<Promise<void> | null>(null);

  React.useEffect(() => {
    setBrowserLogs(getBrowserDevelopmentLogs());

    const stopCapture = startBrowserDevelopmentLogCapture();
    const unsubscribe = subscribeToBrowserDevelopmentLogs((entries) => {
      startTransition(() => {
        setBrowserLogs(entries);
      });
    });

    return () => {
      unsubscribe();
      stopCapture();
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const refreshServerLogs = React.useCallback(async () => {
    if (!isOpen || !isDocumentVisible) {
      return;
    }
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    const request = (async () => {
      setIsRefreshing(true);
      try {
        const nextEntries = await loadServerLogs({
          data: {
            afterId: latestServerLogIdRef.current || undefined,
          },
        });

        if (nextEntries.length === 0) {
          return;
        }

        applyServerLogUpdate(nextEntries, latestServerLogIdRef, setServerLogs);
      } catch (error) {
        browserLogger.warn('Failed to load server logs', {
          error,
        });
      } finally {
        setIsRefreshing(false);
      }
    })();

    inFlightRefreshRef.current = request;

    try {
      await request;
    } finally {
      if (inFlightRefreshRef.current === request) {
        inFlightRefreshRef.current = null;
      }
    }
  }, [isDocumentVisible, isOpen, loadServerLogs]);

  React.useEffect(() => {
    if (!isOpen || !isDocumentVisible) {
      return undefined;
    }

    void refreshServerLogs();

    return () => {
      inFlightRefreshRef.current = null;
    };
  }, [isDocumentVisible, isOpen, refreshServerLogs]);

  const visibleEntries = React.useMemo(() => {
    return [...browserLogs, ...serverLogs]
      .filter((entry) => isVisibleForLevel(levelFilter, entry.level))
      .filter((entry) => isVisibleForSource(sourceFilter, entry.source))
      .sort((left, right) => {
        if (left.timestamp === right.timestamp) {
          return right.id - left.id;
        }
        return right.timestamp.localeCompare(left.timestamp);
      });
  }, [browserLogs, levelFilter, serverLogs, sourceFilter]);

  return (
    <Card className="mx-4 mb-4 mt-auto border-dashed border-border/80 bg-card/95 shadow-shell">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{t('shared.devLogConsole.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('shared.devLogConsole.body')}</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline">
              {isOpen ? t('shared.devLogConsole.close') : t('shared.devLogConsole.open')}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('shared.devLogConsole.levelFilter')}
                </span>
                <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as LogLevelFilter)}>
                  <option value="all">{t('shared.devLogConsole.levelAll')}</option>
                  <option value="debug">{t('shared.devLogConsole.levelDebug')}</option>
                  <option value="info">{t('shared.devLogConsole.levelInfo')}</option>
                  <option value="warn">{t('shared.devLogConsole.levelWarn')}</option>
                  <option value="error">{t('shared.devLogConsole.levelError')}</option>
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('shared.devLogConsole.sourceFilter')}
                </span>
                <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as LogSourceFilter)}>
                  <option value="all">{t('shared.devLogConsole.sourceAll')}</option>
                  <option value="browser">{t('shared.devLogConsole.sourceBrowser')}</option>
                  <option value="server">{t('shared.devLogConsole.sourceServer')}</option>
                </Select>
              </label>
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshServerLogs()}
                disabled={!isOpen || !isDocumentVisible || isRefreshing}
              >
                {t('shared.devLogConsole.refresh')}
              </Button>
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border/70 bg-background/80 p-3">
              {visibleEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('shared.devLogConsole.empty')}</p>
              ) : (
                visibleEntries.map((entry) => {
                  const serializedContext = stringifyContext(entry.context);

                  return (
                    <article
                      key={`${entry.source}-${entry.id}`}
                      className="rounded-md border border-border/70 bg-card/80 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{entry.source}</Badge>
                        <Badge variant="outline">{entry.level}</Badge>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                        {entry.component ? (
                          <span className="text-xs text-muted-foreground">{entry.component}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-foreground">{entry.message}</p>
                      {serializedContext ? (
                        <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                          {serializedContext}
                        </pre>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
