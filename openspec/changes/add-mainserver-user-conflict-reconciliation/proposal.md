# Change: Mainserver-Identitätskonflikte kontrolliert auflösen

## Why

Die persönliche Mainserver-Provisionierung beendet einen Konflikt, bei dem eine E-Mail im Mainserver bereits mit einem anderen Keycloak-Subject existiert, korrekt fail-closed mit `local_user_conflict`. System-Administratoren erhalten jedoch weder einen redigierten Prüfbefund noch einen kontrollierten Weg, eine bestätigte historische Identität zu übernehmen. Wiederholte Reprovisionierung kann diesen Konflikt nicht lösen.

## What Changes

- Neuer, von der normalen Benutzerverwaltung getrennter Reconcile-Pfad für persönliche Mainserver-Identitäten.
- Read-only Konfliktprüfung mit minimierten Statusdaten und deterministischen Ergebnissen.
- Zwei-Schritt-Freigabe: ein `system_admin` beantragt den Rebind, ein zweiter `system_admin` derselben Instanz bestätigt ihn. Antragsteller und Bestätiger müssen verschieden sein.
- Rebind nur über einen expliziten, idempotenten Mainserver-Upstream-Vertrag; ohne diesen Vertrag bleibt der Vorgang in `reconciliation_required`.
- Nach erfolgreichem Rebind werden ausschließlich serverseitig neue persönliche Credentials in Keycloak persistiert, die bestehende DataProvider-Bindung geprüft und der alte Credential-Zustand widerrufen, sofern der Upstream dies bestätigt.
- PII-minimiertes Audit für Prüfung, Antrag, Bestätigung, Durchführung und Ergebnis; Secrets, Tokens und Rohantworten bleiben ausgeschlossen.
- Neuer Status und erklärbare Aktionen in der Benutzer-Detailansicht.

## Non-Goals

- Keine automatische Verknüpfung anhand gleicher E-Mail-Adressen.
- Keine Löschung, Zusammenführung oder Deaktivierung von Mainserver- oder Keycloak-Konten.
- Keine Bulk-Reconciliation und kein Ersatz des bestehenden Bulk-Reprovision-Pfads.
- Keine direkte Datenbankmanipulation im Mainserver oder Keycloak als Ersatz für den Upstream-Vertrag.

## Product Decision

Dieser Vorschlag setzt für Production verpflichtende Vier-Augen-Freigabe voraus. Falls ein einzelner System-Admin genügen soll, muss die Policy vor Implementierungsfreigabe ausdrücklich geändert und die Risikobegründung im ADR dokumentiert werden.

## Impact

- Affected specs: `account-ui`, `iam-access-control`, `iam-auditing`, `sva-mainserver-integration`
- Affected code: `apps/sva-studio-react`, `packages/iam-admin`, `packages/auth-runtime`, `packages/sva-mainserver`, `packages/routing`, gegebenenfalls `packages/data`
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `11-risks-and-technical-debt`
- New ADR: kontrollierte Übernahme historischer Mainserver-Identitäten
