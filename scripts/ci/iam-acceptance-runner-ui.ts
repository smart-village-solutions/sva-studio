import type { AcceptanceConfig } from './iam-acceptance.ts';
import type { AcceptanceSession } from './iam-acceptance-runner-login.ts';
import type { AcceptanceRecorder } from './iam-acceptance-runner-runtime.ts';
import { expectVisible } from './iam-acceptance-runner-runtime.ts';

export const verifyAdminUi = async (
  recorder: AcceptanceRecorder,
  input: {
    adminSession: AcceptanceSession;
    config: AcceptanceConfig;
    memberUser: AcceptanceSession['user'];
  }
): Promise<void> => {
  const page = await input.adminSession.context.newPage();
  try {
    await page.goto(new URL('/admin/users', input.config.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');
    await expectVisible(recorder, page.getByRole('heading', { name: 'Benutzerverwaltung' }), {
      name: 'UI Benutzerliste',
      failureCode: 'acceptance_ui_assertion_failed',
      details: 'Die Benutzerverwaltung wurde nicht geladen.',
    });
    await expectVisible(recorder, page.getByLabel('Suche'), {
      name: 'UI Benutzerliste',
      failureCode: 'acceptance_ui_assertion_failed',
      details: 'Das Suchfeld der Benutzerverwaltung fehlt.',
    });
    await page.getByLabel('Suche').fill(input.config.member.username);
    await page.waitForLoadState('networkidle');
    await expectVisible(
      recorder,
      page.getByRole('link', { name: input.memberUser.name ?? input.config.member.username }),
      {
        name: 'UI Benutzerliste',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Der Acceptance-Member ist in der Benutzerliste nicht sichtbar.',
      }
    );
    recorder.recordStep({
      name: 'UI Benutzerliste',
      status: 'passed',
      details: 'Die Benutzerliste zeigt den Acceptance-Member im aktiven Instanzkontext.',
    });

    await page.goto(new URL('/admin/organizations', input.config.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');
    await expectVisible(recorder, page.getByRole('heading', { name: 'Organisationsverwaltung' }), {
      name: 'UI Organisationsstruktur',
      failureCode: 'acceptance_ui_assertion_failed',
      details: 'Die Organisationsverwaltung wurde nicht geladen.',
    });
    await expectVisible(recorder, page.getByText('Acceptance Parent'), {
      name: 'UI Organisationsstruktur',
      failureCode: 'acceptance_ui_assertion_failed',
      details: 'Die Acceptance-Parent-Organisation ist in der UI nicht sichtbar.',
    });
    await expectVisible(recorder, page.getByText('Acceptance Child Updated'), {
      name: 'UI Organisationsstruktur',
      failureCode: 'acceptance_ui_assertion_failed',
      details: 'Die aktualisierte Acceptance-Child-Organisation ist in der UI nicht sichtbar.',
    });
    await page.getByLabel('Suche').fill('Acceptance Parent');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Mitgliedschaften' }).first().click();
    await page.waitForLoadState('networkidle');
    await expectVisible(
      recorder,
      page.getByText(input.memberUser.name ?? input.config.member.username),
      {
        name: 'UI Membership-Nachweis',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Die Membership-Zuweisung ist in der UI nicht sichtbar.',
      }
    );
    await expectVisible(recorder, page.getByText('Standardkontext'), {
      name: 'UI Membership-Nachweis',
      failureCode: 'acceptance_ui_assertion_failed',
      details: 'Der Default-Kontext wird in der Membership-UI nicht angezeigt.',
    });
    recorder.recordStep({
      name: 'UI Organisationsstruktur',
      status: 'passed',
      details:
        'Organisationsstruktur und Membership-Zuweisung wurden in der Admin-Oberfläche nachgewiesen.',
    });
  } finally {
    await page.close();
  }
};
