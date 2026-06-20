import type { AcceptanceDeployReport } from './runtime-env.shared.types.ts';

const renderProbe = (probe: { durationMs: number; httpStatus?: number; message: string; name: string; status: string; target: string }) =>
  `- \`${probe.name}\` -> \`${probe.status}\` (${probe.durationMs} ms, target=${probe.target}, http=${probe.httpStatus ?? 'n/a'}): ${probe.message}`;

const renderJob = (label: 'Bootstrap' | 'Migration', reportStatus: AcceptanceDeployReport['migrationReport'] | undefined) => {
  if (!reportStatus) return [`- ${label}-Status: \`n/a\``];

  const lines = [`- ${label}-Status: \`${reportStatus.status}\``];
  if (reportStatus.job) {
    lines.push(`- ${label === 'Migration' ? 'Migrationsjob' : 'Bootstrap-Job'}: \`${reportStatus.job.jobStackName}/${reportStatus.job.jobServiceName}\``);
    lines.push(`- ${label === 'Migration' ? 'Job-Exit-Code' : 'Bootstrap-Exit-Code'}: \`${reportStatus.job.exitCode ?? 'n/a'}\``);
  }

  const gooseVersion = reportStatus.details?.gooseVersion;
  if (typeof gooseVersion === 'string' && gooseVersion.length > 0) lines.push(`- Goose-Version: \`${gooseVersion}\``);
  return lines;
};

const markdownHeaderSection = (report: AcceptanceDeployReport) => [
  `# Deploy-Report ${report.reportId}`,
  '',
  `- Profil: \`${report.profile}\``,
  `- Status: \`${report.status}\``,
  `- Release-Modus: \`${report.releaseMode}\``,
  `- Zeitpunkt: \`${report.generatedAt}\``,
  `- Actor: \`${report.actor}\``,
  `- Workflow: \`${report.workflow}\``,
  `- Stack: \`${report.stackName}\``,
  `- Image-Ref: \`${report.imageRef}\``,
  `- Image-Tag: \`${report.imageTag ?? 'n/a'}\``,
  `- Image-Digest: \`${report.imageDigest}\``,
  `- Wartungsfenster: \`${report.maintenanceWindow ?? 'nicht erforderlich'}\``,
  `- Rollback-Hinweis: ${report.rollbackHint}`,
  report.failureCategory ? `- Fehlerkategorie: \`${report.failureCategory}\`` : null,
  `- Technical Gate: \`${report.releaseDecision.technicalGatePassed ? 'passed' : 'failed'}\``,
  `- Freigabeentscheidung: ${report.releaseDecision.summary}`,
];

const markdownStepSection = (report: AcceptanceDeployReport) => [
  '## Schritte',
  '',
  ...report.steps.map((step) => `- \`${step.name}\` -> \`${step.status}\` (${step.durationMs} ms): ${step.summary}`),
];

const markdownMigrationSection = (report: AcceptanceDeployReport) => [
  '## Migration',
  '',
  ...(report.migrationFiles.length > 0 ? report.migrationFiles.map((migrationFile) => `- \`${migrationFile}\``) : ['- keine']),
  ...renderJob('Migration', report.migrationReport),
];

const markdownProbeSection = (title: string, probes: readonly AcceptanceDeployReport['internalProbes'][number][]) => [
  title,
  '',
  ...(probes.length > 0 ? probes.map(renderProbe) : ['- keine']),
];

const markdownRuntimeContractSection = (report: AcceptanceDeployReport) => [
  '## Runtime Contract',
  '',
  `- Erforderliche Schluessel: \`${report.runtimeContract.requiredKeys.join(', ') || 'keine'}\``,
  `- Ableitbare Schluessel: \`${report.runtimeContract.derivedKeys.join(', ') || 'keine'}\``,
];

const markdownObservabilitySection = (report: AcceptanceDeployReport) => [
  '## Observability',
  '',
  report.observability.grafanaUrl ? `- Grafana: ${report.observability.grafanaUrl}` : '- Grafana: n/a',
  report.observability.lokiUrl ? `- Loki: ${report.observability.lokiUrl}` : '- Loki: n/a',
  ...report.observability.notes.map((note) => `- Hinweis: ${note}`),
];

const markdownStackStatusSection = (report: AcceptanceDeployReport) => [
  '## Stack Status',
  '',
  report.stackStatus?.services ?? '- services: n/a',
  report.stackStatus?.tasks ?? '- tasks: n/a',
];

export const formatAcceptanceDeployReportMarkdown = (report: AcceptanceDeployReport) => {
  const sections = [
    markdownHeaderSection(report),
    markdownStepSection(report),
    markdownMigrationSection(report),
    ['## Bootstrap', '', ...renderJob('Bootstrap', report.bootstrapReport)],
    markdownProbeSection('## Interne Probes', report.internalProbes),
    markdownProbeSection('## Externe Probes', report.externalProbes),
    markdownRuntimeContractSection(report),
    markdownObservabilitySection(report),
    markdownStackStatusSection(report),
  ];
  return sections.flatMap((section) => [...section, '']).filter((line): line is string => line !== null).join('\n').trimEnd();
};
