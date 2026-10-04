import type {
  SonarHotspotSearchItem,
  SonarHotspotDetails,
  SonarIssueSearchItem,
  SonarIssueDetails,
} from './sonar-hotspots-types.ts';

export const formatListTable = (hotspots: readonly SonarHotspotSearchItem[]): string => {
  if (hotspots.length === 0) {
    return 'Keine Hotspots gefunden.';
  }

  const lines = hotspots.map((hotspot) => {
    const location = hotspot.line ? `${hotspot.component}:${hotspot.line}` : hotspot.component;
    const status = hotspot.status ?? 'UNKNOWN';
    const probability = hotspot.vulnerabilityProbability ?? '-';
    const ruleKey = hotspot.ruleKey ?? '-';
    return `${hotspot.key}\t${status}\t${probability}\t${ruleKey}\t${location}`;
  });

  return ['key\tstatus\tprobability\trule\tlocation', ...lines].join('\n');
};

const escapeCsvField = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};

export const formatListCsv = (hotspots: readonly SonarHotspotSearchItem[]): string => {
  const header = ['key', 'status', 'probability', 'rule', 'component', 'line', 'message'];
  const rows = hotspots.map((hotspot) =>
    [
      hotspot.key,
      hotspot.status ?? '',
      hotspot.vulnerabilityProbability ?? '',
      hotspot.ruleKey ?? '',
      hotspot.component,
      hotspot.line !== undefined ? String(hotspot.line) : '',
      hotspot.message ?? '',
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
};

export const formatIssueTable = (issues: readonly SonarIssueSearchItem[]): string => {
  if (issues.length === 0) {
    return 'Keine Issues gefunden.';
  }

  const lines = issues.map((issue) => {
    const location = issue.line ? `${issue.component}:${issue.line}` : issue.component;
    return `${issue.key}\t${issue.status ?? '-'}\t${issue.severity ?? '-'}\t${issue.type ?? '-'}\t${issue.rule ?? '-'}\t${location}`;
  });

  return ['key\tstatus\tseverity\ttype\trule\tlocation', ...lines].join('\n');
};

export const formatIssueCsv = (issues: readonly SonarIssueSearchItem[]): string => {
  const header = ['key', 'status', 'severity', 'type', 'rule', 'component', 'line', 'message'];
  const rows = issues.map((issue) =>
    [
      issue.key,
      issue.status ?? '',
      issue.severity ?? '',
      issue.type ?? '',
      issue.rule ?? '',
      issue.component,
      issue.line !== undefined ? String(issue.line) : '',
      issue.message ?? '',
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
};

export const formatHotspotDetails = (hotspot: SonarHotspotDetails): string => {
  const commentLines = (hotspot.comments ?? []).map(
    (comment) => `- ${comment.createdAt ?? 'unbekannt'}: ${comment.markdown}`
  );

  return [
    `key: ${hotspot.key}`,
    `component: ${hotspot.component}`,
    `line: ${hotspot.line ?? '-'}`,
    `status: ${hotspot.status ?? '-'}`,
    `resolution: ${hotspot.resolution ?? '-'}`,
    `securityCategory: ${hotspot.securityCategory ?? '-'}`,
    `probability: ${hotspot.vulnerabilityProbability ?? '-'}`,
    `rule: ${hotspot.rule?.key ?? '-'}${hotspot.rule?.name ? ` (${hotspot.rule.name})` : ''}`,
    `message: ${hotspot.message ?? '-'}`,
    hotspot.rule?.fixRecommendations
      ? `fixRecommendations: ${hotspot.rule.fixRecommendations}`
      : 'fixRecommendations: -',
    commentLines.length > 0 ? `comments:\n${commentLines.join('\n')}` : 'comments: -',
  ].join('\n');
};

export const formatIssueDetails = (issue: SonarIssueDetails): string => {
  const commentLines = (issue.comments ?? []).map(
    (comment) => `- ${comment.createdAt ?? 'unbekannt'}: ${comment.markdown ?? ''}`
  );
  const impacts = (issue.impacts ?? []).map(
    (impact) => `${impact.softwareQuality ?? 'unknown'}:${impact.severity ?? 'unknown'}`
  );

  return [
    `key: ${issue.key}`,
    `component: ${issue.component}`,
    `line: ${issue.line ?? '-'}`,
    `status: ${issue.status ?? '-'}`,
    `severity: ${issue.severity ?? '-'}`,
    `type: ${issue.type ?? '-'}`,
    `rule: ${issue.rule ?? '-'}`,
    `assignee: ${issue.assignee ?? '-'}`,
    `message: ${issue.message ?? '-'}`,
    `impacts: ${impacts.length > 0 ? impacts.join(', ') : '-'}`,
    `transitions: ${issue.transitions?.join(', ') ?? '-'}`,
    commentLines.length > 0 ? `comments:\n${commentLines.join('\n')}` : 'comments: -',
  ].join('\n');
};
