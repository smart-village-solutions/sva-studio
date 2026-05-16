import { describe, expect, it } from 'vitest';

import { renderStagehandMarkdownReport } from './report.ts';

describe('renderStagehandMarkdownReport', () => {
  it('renders the markdown report in German', () => {
    const report = {
      generatedAt: '2026-05-16T08:30:00.000Z',
      mission: 'admin-users-overview' as const,
      status: 'passed' as const,
      findings: ['Users list loaded', 'No permission edit controls visible'],
      screenshots: ['artifacts/admin-users-overview-01.png'],
      transcriptPath: 'artifacts/admin-users-overview.jsonl',
    };

    const markdown = renderStagehandMarkdownReport(report);

    expect(markdown).toContain('# Stagehand-Missionsbericht');
    expect(markdown).toContain('Mission: `admin-users-overview`');
    expect(markdown).toContain('Status: `passed`');
    expect(markdown).toContain('Transkript:');
    expect(markdown).toContain('```text\nartifacts/admin-users-overview.jsonl\n```');
    expect(markdown).toContain('Users list loaded');
    expect(markdown).toContain('No permission edit controls visible');
    expect(markdown).toContain('- Screenshot\n  ```text\n  artifacts/admin-users-overview-01.png\n  ```');
  });

  it('renders German fallback text for empty findings and screenshots', () => {
    const markdown = renderStagehandMarkdownReport({
      generatedAt: '2026-05-16T08:30:00.000Z',
      mission: 'admin-users-overview',
      status: 'blocked',
      findings: [],
      screenshots: [],
      transcriptPath: 'artifacts/admin-users-overview.jsonl',
    });

    expect(markdown).toContain('## Erkenntnisse');
    expect(markdown).toContain('## Screenshots');
    expect(markdown).toContain('- Keine');
  });

  it('renders multiline findings as stable markdown list items', () => {
    const markdown = renderStagehandMarkdownReport({
      generatedAt: '2026-05-16T08:30:00.000Z',
      mission: 'admin-users-overview',
      status: 'failed',
      findings: ['Erste Zeile\nZweite `Zeile`'],
      screenshots: [],
      transcriptPath: 'artifacts/admin-users-overview.jsonl',
    });

    expect(markdown).toContain('## Erkenntnisse');
    expect(markdown).toContain('- Erste Zeile\n  Zweite \\`Zeile\\`');
  });

  it('preserves backslashes in findings while still escaping backticks', () => {
    const markdown = renderStagehandMarkdownReport({
      generatedAt: '2026-05-16T08:30:00.000Z',
      mission: 'admin-users-overview',
      status: 'failed',
      findings: ['Pfad C:\\temp\\stagehand und `Hinweis`'],
      screenshots: [],
      transcriptPath: 'artifacts/admin-users-overview.jsonl',
    });

    expect(markdown).toContain('- Pfad C:\\temp\\stagehand und \\`Hinweis\\`');
  });

  it('preserves content for findings that start with a newline', () => {
    const markdown = renderStagehandMarkdownReport({
      generatedAt: '2026-05-16T08:30:00.000Z',
      mission: 'admin-users-overview',
      status: 'failed',
      findings: ['\nWichtige zweite Zeile'],
      screenshots: [],
      transcriptPath: 'artifacts/admin-users-overview.jsonl',
    });

    expect(markdown).toContain('## Erkenntnisse');
    expect(markdown).toContain('-\n  Wichtige zweite Zeile');
  });

  it('renders transcript and screenshots safely for multiline values and backticks', () => {
    const markdown = renderStagehandMarkdownReport({
      generatedAt: '2026-05-16T08:30:00.000Z',
      mission: 'admin-users-overview',
      status: 'passed',
      findings: [],
      screenshots: ['artifacts/shot-`01`.png\nartifacts/shot-02.png'],
      transcriptPath: 'artifacts/trace-`raw`\ntrace.jsonl',
    });

    expect(markdown).toContain('Transkript:');
    expect(markdown).toContain('```text\nartifacts/trace-`raw`\ntrace.jsonl\n```');
    expect(markdown).toContain('## Screenshots');
    expect(markdown).toContain(
      '- Screenshot\n  ```text\n  artifacts/shot-`01`.png\n  artifacts/shot-02.png\n  ```'
    );
  });
});
