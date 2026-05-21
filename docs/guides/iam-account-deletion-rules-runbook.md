# IAM-Konten-Löschregeln Runbook

## Zweck

Dieses Runbook beschreibt den operativen Lauf für tenantbezogene Konten-Löschregeln. Der aktuelle V1-Stand verarbeitet Tenant-Accounts entlang des Inaktivitäts-Lifecycles `active -> deactivated -> pseudonymized -> deleted` und behandelt `iam.contents` optional referenzwahrend mit.

## Wichtige Fachgrenzen

- Der Lauf löscht weder Accounts noch `iam.contents` physisch.
- `deleted` ist ein finaler Tombstone-Soft-Delete.
- Inaktivität wird nur aus erfolgreichen Login-Events abgeleitet:
  - Quelle: `iam.activity_logs`
  - Kriterium: `event_type = 'login'` und `result = 'success'`
- Accounts ohne erfolgreiches Login-Event werden von diesem V1-Mechanismus nicht verarbeitet.
- Ein einzelner Lauf bewegt einen Account höchstens um eine Stufe weiter.
- Inhalte werden nur mitbehandelt, wenn die effektive Inhaltsstrategie `with_owner_lifecycle` ist.

## Operativer Einstieg

V1 enthält in diesem Change keinen eingebauten Scheduler. Die Ausführung erfolgt nur über einen expliziten operativen Trigger, zum Beispiel manuell oder per externem Cronjob.

Kommando:

```bash
pnpm iam:account-deletion-rules:run --instanceId=<tenant-id>
```

Dry-Run:

```bash
pnpm iam:account-deletion-rules:run --instanceId=<tenant-id> --dryRun
```

Voraussetzungen:

- `IAM_DATABASE_URL` muss gesetzt sein.
- `--instanceId` ist verpflichtend.

## Wirkung des Laufs

### Accounts

- `deactivated`
  - setzt `deletion_lifecycle_state = 'deactivated'`
  - setzt `deactivated_at`, falls noch leer
- `pseudonymized`
  - setzt `deletion_lifecycle_state = 'pseudonymized'`
  - setzt `pseudonymized_at`, falls noch leer
  - entfernt direkte Account-PII aus `iam.accounts`
  - setzt `status = 'inactive'`
- `deleted`
  - setzt `deletion_lifecycle_state = 'deleted'`
  - setzt `deletion_marked_at`, falls noch leer
  - bleibt referenzwahrend und löscht den Datensatz nicht physisch

Zusätzlich blockiert die Runtime authentifizierte Tenant-Accounts, sobald ihr Lifecycle-Zustand nicht mehr `active` ist.

### Inhalte

Bei effektiver Strategie `with_owner_lifecycle` werden passende `iam.contents`-Datensätze ebenfalls aktualisiert:

- `deletion_lifecycle_state`
- `deletion_lifecycle_changed_at`
- `updated_at`
- `author_display_name`
  - pseudonymisiert über einen stabilen Token
  - gelöscht über einen stabilen Token

Auch hier erfolgt keine physische Löschung von Zeilen.

## Ergebnisformat

Der Runner gibt eine JSON-Zusammenfassung aus, zum Beispiel:

```json
{
  "instanceId": "de-musterhausen",
  "evaluatedAccounts": 12,
  "deactivatedAccounts": 2,
  "pseudonymizedAccounts": 1,
  "deletedAccounts": 0,
  "tombstonedContents": 5
}
```

Bedeutung:

- `evaluatedAccounts`: Accounts mit erfolgreichem Login-Ereignis, die fachlich betrachtet wurden
- `deactivatedAccounts`: in diesem Lauf neu nach `deactivated` bewegt
- `pseudonymizedAccounts`: in diesem Lauf neu nach `pseudonymized` bewegt
- `deletedAccounts`: in diesem Lauf neu nach `deleted` bewegt
- `tombstonedContents`: betroffene `iam.contents`-Zeilen mit referenzwahrender Lifecycle-Aktualisierung

## Empfohlener Betriebsablauf

1. Zuerst immer `--dryRun` gegen den Tenant ausführen.
2. Ergebniszahlen auf Plausibilität prüfen.
3. Erst danach den schreibenden Lauf ohne `--dryRun` ausführen.
4. Nach dem Lauf stichprobenartig prüfen:
   - betroffene Accounts in `iam.accounts`
   - betroffene Inhalte in `iam.contents`
   - Self-Service- und Admin-Anzeigen im Tenant

## Bekannte Grenzen in V1

- Kein eingebauter Scheduler in diesem Change
- Keine automatische Reaktivierung
- Keine physische Löschung von Accounts oder Inhalten
- Keine Verarbeitung anderer Inhaltsdomänen als `iam.contents`
