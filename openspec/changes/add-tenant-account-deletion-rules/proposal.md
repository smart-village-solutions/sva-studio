# Change: Tenantbezogene Löschregeln für Accounts ergänzen

## Why

Im IAM fehlt bislang ein tenantbezogenes Regelwerk, mit dem inaktive Tenant-Accounts nachvollziehbar deaktiviert, pseudonymisiert und in einen finalen Tombstone-Zustand überführt werden können. Ebenso fehlen eine Admin-Oberfläche für diese Regeln, transparente Self-Service-Anzeigen und explizite Governance-Vorgaben für Berechtigungen und Audits.

## What Changes

- Für Tenant-Accounts wird ein konfigurierbarer Inaktivitäts-Lebenszyklus mit den Zuständen `active`, `deactivated`, `pseudonymized` und `deleted` spezifiziert.
- Neue oder noch nicht konfigurierte Tenants verwenden normative Baseline-Defaults/Fallbacks von `90 / 180 / 365` Tagen für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete.
- `/admin/iam` erhält einen neuen Tab `deletion-rules` für tenantbezogene Default-Regeln zu `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` und zur Default-Strategie für eigene Inhalte.
- Für unkonfigurierte Tenants zeigt die Admin-UI die Baseline-Defaults `90 / 180 / 365` und die geerbte Inhaltsstrategie als wirksamen Zustand; Speichern erzeugt oder aktualisiert eine explizite tenantbezogene Konfiguration.
- `/account/privacy` und verwandte Account-Flächen zeigen die tenantweiten Löschregeln transparent an und erlauben einen per-Account-Override für die Behandlung eigener Inhalte.
- V1 leitet Inaktivität ausschließlich aus `last_login_at` ab; ein neues Aktivitäts-Tracking-System ist nicht Bestandteil dieses Changes.
- `last_login_at` wird tenantbezogen gegen den Tenant-Account-Record beziehungsweise den aktiven Tenant-Mitgliedschaftskontext bewertet und nicht als globales Cross-Tenant-Inaktivitätssignal.
- `deactivated` wird nicht automatisch durch einen Login aufgehoben; eine Reaktivierung verlangt einen separaten Prozess, andernfalls können spätere automatische Lifecycle-Stufen weiterlaufen.
- Die finale Lebenszyklusstufe ist ein Tombstone-Soft-Delete; physische Hard-Deletes und Inhaltsdomänen außerhalb von `iam.contents` bleiben explizit außerhalb des Scopes.
- Für das Bearbeiten der Regeln und das Ausführen des Lebenszyklus werden tenantgebundene Permissions, eine dedizierte tenantgebundene technische Service-Identität für geplante Läufe und revisionssichere Audit-Events normiert.

## Impact

- Affected specs: `account-ui`, `iam-data-subject-rights`, `iam-access-control`, `iam-auditing`
- Affected code: `apps/sva-studio-react`, `packages/auth`, `packages/data`, `packages/iam-*`, periodische IAM-Lifecycle-Jobs
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
