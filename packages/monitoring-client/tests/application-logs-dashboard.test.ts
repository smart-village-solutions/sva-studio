import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type LogsPanelTarget = {
  expr?: string;
};

type LogsPanel = {
  title?: string;
  targets?: LogsPanelTarget[];
};

type DashboardDefinition = {
  panels?: LogsPanel[];
};

const dashboardPath = resolve(
  process.cwd(),
  '../../dev/monitoring/grafana/dashboards/application-logs.json'
);

const dashboard = JSON.parse(
  readFileSync(dashboardPath, 'utf8')
) as DashboardDefinition;

describe('application logs dashboard', () => {
  it('targets the OTEL app stream instead of docker-only component labels', () => {
    const logsPanel = dashboard.panels?.find((panel) => panel.title === 'Application Logs');

    expect(logsPanel).toBeDefined();
    expect(logsPanel?.targets?.[0]?.expr).toBe('{job="sva-studio"}');
  });
});
