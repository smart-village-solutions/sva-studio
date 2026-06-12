import type { AuditCheckResult, StudioInstanceAuditResult } from './model.ts';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const renderCheckRow = (check: AuditCheckResult): string => `
  <tr>
    <td>${escapeHtml(check.checkId)}</td>
    <td class="status-${check.status}">${escapeHtml(check.status)}</td>
    <td>${escapeHtml(check.title)}</td>
    <td>${escapeHtml(check.summary)}</td>
  </tr>`;

export const renderStudioInstanceAuditHtml = (
  result: StudioInstanceAuditResult,
): string => {
  const counts = {
    fail: result.instances.filter((instance) => instance.status === 'fail').length,
    pass: result.instances.filter((instance) => instance.status === 'pass').length,
    warn: result.instances.filter((instance) => instance.status === 'warn').length,
  };

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Studio Instanz-Audit</title>
    <style>
      :root {
        color-scheme: light;
        --border: #d7dde5;
        --card: #ffffff;
        --fail: #b42318;
        --ink: #122033;
        --muted: #5f6f82;
        --page: #f4f7fb;
        --pass: #117a37;
        --warn: #b26b00;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--page); color: var(--ink); }
      main { max-width: 1280px; margin: 0 auto; padding: 32px 24px 48px; }
      h1, h2 { margin: 0; }
      p { color: var(--muted); }
      .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 24px 0; }
      .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; }
      .status-pass { color: var(--pass); }
      .status-warn { color: var(--warn); }
      .status-fail { color: var(--fail); }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
      .instance + .instance { margin-top: 20px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Studio Instanz-Audit</h1>
      <p>Profil: ${escapeHtml(result.profile)}<br />Erstellt: ${escapeHtml(result.generatedAt)}<br />Gesamtstatus: <strong class="status-${result.status}">${escapeHtml(result.status)}</strong></p>
      <section class="summary">
        <article class="card"><strong class="status-pass">${counts.pass}</strong><br />Pass</article>
        <article class="card"><strong class="status-warn">${counts.warn}</strong><br />Warn</article>
        <article class="card"><strong class="status-fail">${counts.fail}</strong><br />Fail</article>
      </section>
      ${result.instances
        .map(
          (instance) => `
        <section class="card instance">
          <h2 class="status-${instance.status}">${escapeHtml(instance.instanceId)} (${escapeHtml(instance.status)})</h2>
          <p>${escapeHtml(instance.primaryHostname)} · Realm ${escapeHtml(instance.authRealm)} · Client ${escapeHtml(instance.authClientId)}</p>
          <table>
            <thead>
              <tr>
                <th>Check-ID</th>
                <th>Status</th>
                <th>Titel</th>
                <th>Zusammenfassung</th>
              </tr>
            </thead>
            <tbody>
              ${instance.checks.map(renderCheckRow).join('')}
            </tbody>
          </table>
        </section>`,
        )
        .join('')}
    </main>
  </body>
</html>`;
};
