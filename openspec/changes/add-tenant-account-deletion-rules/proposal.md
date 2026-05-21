# Change: Tenantbezogene Löschregeln für Accounts ergänzen

## Why

Im IAM fehlt bislang ein tenantbezogenes Regelwerk, mit dem inaktive Tenant-Accounts nachvollziehbar deaktiviert, pseudonymisiert und in einen finalen Tombstone-Zustand überführt werden können. Ebenso fehlen eine Admin-Oberfläche für diese Regeln, transparente Self-Service-Anzeigen und explizite Governance-Vorgaben für Berechtigungen und Audits.

## What Changes

- Für Tenant-Accounts wird ein konfigurierbarer Inaktivitäts-Lebenszyklus mit den Zuständen `active`, `deactivated`, `pseudonymized` und `deleted` spezifiziert.
- Neue oder noch nicht konfigurierte Tenants verwenden normative Baseline-Defaults/Fallbacks von `90 / 180 / 365` Tagen für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete.
- `/admin/iam` erhält einen neuen Tab `deletion-rules` für tenantbezogene Regeln zu `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays`, zur Default-Strategie für eigene Inhalte und zu einem Tenant-Schalter, ob Nutzer diese Inhaltsregel überschreiben dürfen.
- Für unkonfigurierte Tenants zeigt die Admin-UI die Baseline-Defaults `90 / 180 / 365`, die geerbte Inhaltsstrategie `beibehalten` und den Override-Schalter standardmäßig deaktiviert als wirksamen Zustand; Speichern erzeugt oder aktualisiert eine explizite tenantbezogene Konfiguration.
- `/account/privacy` und verwandte Account-Flächen zeigen die tenantweiten Löschregeln transparent an. Tenant-Accounts sehen dort ihren Lifecycle-Status, den aus Login-Events abgeleiteten letzten Login und, falls tenantseitig erlaubt, einen per-Account-Override für die Behandlung eigener Inhalte.
- V1 leitet Inaktivität ausschließlich aus `MAX(iam.activity_logs.created_at WHERE event_type = 'login')` pro Tenant-Account ab; ein neues Aktivitäts-Tracking-System ist nicht Bestandteil dieses Changes.
- Das persistierte Feld `iam.accounts.last_login_at` wird in V1 nicht zur führenden fachlichen Wahrheit gemacht.
- `deactivated` wird nicht automatisch durch einen Login aufgehoben; eine Reaktivierung verlangt einen separaten Prozess, andernfalls können spätere automatische Lifecycle-Stufen weiterlaufen.
- Die finale Lebenszyklusstufe ist ein Tombstone-Soft-Delete; physische Hard-Deletes und Inhaltsdomänen außerhalb von `iam.contents` bleiben explizit außerhalb des Scopes, und auch `iam.contents` bleibt in V1 rein zustandsbasiert statt physisch gelöscht.
- Die tenantweite Inhaltsstrategie ist in V1 bewusst binär: `beibehalten` oder `mit Eigentümer-Lifecycle mitbehandeln`.
- Der per-Account-Override für die Inhaltsstrategie ist ein Self-Service-Schreibpfad nur für den eigenen Tenant-Account und kann tenantseitig vollständig deaktiviert werden; ein separater Admin-Schreibpfad für fremde Overrides wird in diesem Change nicht eingeführt.
- Für die Lifecycle-Ausführung wird ein Runtime-/Ops-Einstieg bereitgestellt, der tenantbezogen arbeitet und denselben Login-Zeitpunkt verwendet wie die bestehenden IAM-Read-Modelle.

## Impact

- Affected specs: `account-ui`, `iam-data-subject-rights`, `iam-access-control`
- Affected code: `apps/sva-studio-react`, `packages/auth`, `packages/data`, `packages/iam-*`, periodische IAM-Lifecycle-Jobs
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
