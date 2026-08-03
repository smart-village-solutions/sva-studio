## Context

SVA Studio persistiert Permissions instanzgebunden in Postgres. Neue Core-Rechte, Modulrechte und Grants für die geschützte Tenant-Rolle `system_admin` gelangen heute über mehrere Pfade in die Datenbank. Die Quellen sind nicht vollständig gekoppelt: Eine Migration kann bestehende Tenants korrigieren, während ein später angelegter Tenant aus einer veralteten Runtime-Baseline erneut unvollständig entsteht.

Der aktuelle Vorfall zeigt dieses Muster bei `iam.accounts.delete`: Die katalogisierte Seed-Basis und Migration kennen die Permission, die separat gepflegte Runtime-Baseline jedoch nicht.

## Goals / Non-Goals

### Goals

- Genau eine fachliche Quelle für bekannte Permission-Definitionen schaffen.
- Neue und bestehende Tenants über denselben idempotenten Vertrag auf den additiven Sollstand bringen.
- Tenantweite Permissions standardmäßig an `system_admin` vergeben, sofern keine explizite Ausnahme definiert ist.
- Modul-Permissions spätestens bei Modulaktivierung materialisieren und an `system_admin` binden.
- Persistierte Permissions und Grants niemals allein aufgrund einer Katalogentfernung automatisch löschen.
- Root-/Tenant-Grenzen, Custom-Rollen und manuelle Grants unverändert schützen.
- Den Soll-/Ist-Abgleich beobachtbar, testbar und über den kanonischen Rollout wiederholbar machen.

### Non-Goals

- Keine frei editierbare Permission-Verwaltung über die Studio-UI.
- Keine automatische Löschung oder Umbenennung bestehender Permissions.
- Keine automatische Migration von Custom-Rollen auf neue Permissions.
- Kein Runtime-Bypass für `system_admin`; Autorisierung bleibt permission-zentriert.
- Kein zweiter Deployment- oder Datenbank-Reparaturpfad neben dem kanonischen Rollout.

## Decisions

### Decision: Typsicherer Katalog ist die einzige fachliche Definitionsquelle

Der Katalog liegt in einem framework- und persistenzunabhängigen Workspace-Package. Ein Eintrag enthält mindestens:

```ts
type PermissionDefinition = {
  readonly key: PermissionKey;
  readonly description: string;
  readonly resourceType: string;
  readonly availability:
    | { readonly kind: 'root' }
    | { readonly kind: 'tenant' }
    | { readonly kind: 'module'; readonly moduleId: StudioModuleId };
  readonly systemAdminGrant?: boolean;
  readonly lifecycle?: 'active' | 'deprecated';
};
```

Der effektive Default für `systemAdminGrant` ist für `tenant` und `module` `true`, für `root` immer `false`. Eine widersprüchliche Root-Definition wird bei Build oder Test abgewiesen.

Stabile Datenbank-IDs sind kein fachliches Merkmal des Katalogs. Runtime-Reconcile verwendet `(instance_id, permission_key)` als natürliche idempotente Identität und erzeugt IDs in der Datenbank. Deterministische IDs bestehender statischer Testseeds bleiben auf den jeweiligen Fixture-/Seed-Kontext begrenzt.

### Decision: Core- und Modulbeiträge werden zu einer validierten Katalogsicht komponiert

Core-Permissions werden zentral deklariert. Modul-Permissions stammen weiterhin aus der kanonischen Modul-IAM-Vertragsfamilie, werden aber durch denselben Katalog-Validator normalisiert. Dadurch entsteht keine zweite Plugin- oder Modulliste.

Die Komposition schlägt bei doppelten Keys, unbekannten Modul-IDs, fremden Namespaces, ungültigen Ressourcentypen oder widersprüchlichen Availability-Angaben fehl.

### Decision: Reconcile ist additiv und idempotent

Der Reconcile berechnet pro Tenant:

1. alle aktiven tenantweiten Definitionen;
2. alle aktiven Definitionen der zugewiesenen Module;
3. die daraus folgenden verwalteten `system_admin`-Grants.

Er führt Upserts für `iam.permissions` und fehlende verwaltete `iam.role_permissions` aus. Er verändert keine Account-Rollenzuweisungen, Custom-Rollen, manuellen Grants oder Grants anderer Rollen.

Er löscht keine Permission-Zeile, wenn ein Eintrag aus dem Katalog entfernt oder auf `deprecated` gesetzt wurde. Destruktive Bereinigung benötigt eine eigene, explizite Migration mit eigener Freigabe.

### Decision: Modul-Lifecycle trennt Definition und Wirksamkeit

Eine Modul-Permission muss spätestens bei Aktivierung des Moduls im Tenant materialisiert werden. Bereits vorher oder nach einer Deaktivierung vorhandene Permission-Zeilen sind zulässig.

Bei Moduldeaktivierung darf der bestehende, klar modulverwaltete Grant an `system_admin` entsprechend dem bisherigen Modulentzugsvertrag entfernt werden. Die Permission-Definition selbst bleibt erhalten. Manuelle Grants und Custom-Rollen bleiben unberührt.

### Decision: Reconcile wird in bestehende kontrollierte Abläufe integriert

Der Katalog-Reconcile läuft bei:

- initialem Tenant-Baseline-Seed;
- Modulaktivierung und Moduldeaktivierung;
- explizitem, wiederholbarem IAM-Baseline-Reconcile;
- dem kontrollierten Nachziehschritt des kanonischen Rollout-Prozesses für bestehende Tenants.

Der Reconcile invalidiert nur betroffene Instanz-Snapshots und erzeugt ein Audit-Ergebnis mit Zählwerten für eingefügte, aktualisierte, unveränderte und übersprungene Definitionen beziehungsweise Grants. Freie Permission-Payloads oder freie SQL-Eingaben sind nicht Teil des Operatorvertrags.

### Decision: Schema-Migrationen und Katalogdaten bleiben getrennte Verantwortungen

Goose-Migrationen bleiben für Schema, Constraints und ausdrücklich freigegebene destruktive Datenänderungen zuständig. Normales Hinzufügen einer Permission erfordert künftig:

1. einen Katalogeintrag;
2. Tests und Review;
3. den additiven Reconcile im Rollout.

Damit wirkt eine neue Permission auf bestehende und zukünftige Tenants, ohne pro Permission handgeschriebene SQL-Backfills zu verlangen.

## Alternatives considered

### Handgeschriebene SQL-Migration pro Permission

Gut auditierbar, aber sie korrigiert nur zum Ausführungszeitpunkt vorhandene Tenants und verhindert keine veralteten Runtime-Baselines. Deshalb bleibt sie nur für Sonderfälle bestehen.

### SQL-Migrationen automatisch aus dem Katalog generieren

Dies erzeugt zusätzliche Snapshots und Generatorzustände, die ebenfalls driften können. Außerdem vermischt es additive Referenzdatenpflege mit Schemahistorie. Ein kontrollierter Reconcile ist direkter und wiederholbar.

### Sämtliche Modul-Permissions in jedem Tenant vorab materialisieren

Technisch möglich, aber unnötig groß und weniger transparent. Aktivierungsgebundene Materialisierung hält die fachlich relevante Basis klein, ohne bereits vorhandene Zeilen zu verbieten.

## Risks / Trade-offs

- Ein fehlerhafter Katalogeintrag könnte viele Tenants betreffen. Gegenmaßnahme: strikte Typen, Validatoren, Diff-/Dry-Run-Evidenz und kontrollierter Rollout.
- Additive Semantik hinterlässt deprecated Daten. Gegenmaßnahme: Lifecycle-Metadaten und separate, explizite Cleanup-Changes.
- Moduldeaktivierung benötigt klare Grant-Provenance. Gegenmaßnahme: nur eindeutig system-/modulverwaltete Grants dürfen automatisch entzogen werden.
- Eine neue zentrale Package-Abhängigkeit könnte Zyklen erzeugen. Gegenmaßnahme: Katalogtypen und Core-Definitionen liegen in einer neutralen Schicht; Persistenz und Registry konsumieren sie nur in eine Richtung.

## Migration Plan

1. Katalogtypen, Core-Definitionen und Validatoren einführen.
2. Bestehende Modul-IAM-Verträge in die validierte Katalogsicht integrieren.
3. Seed-Plan und Runtime-Baseline auf den Katalog umstellen; Parallelarrays entfernen.
4. Additiven Repository-Reconcile mit Transaktion, Audit-Zählwerten und Snapshot-Invalidierung implementieren.
5. Tenant-Erstellung, Modul-Lifecycle und expliziten Baseline-Pfad anbinden.
6. Dry-Run beziehungsweise Plan-Evidenz für bestehende Tenants prüfen.
7. Über den kanonischen Staging-Rollout reconciliieren und `de-studio-sandbox` über `/iam/me/permissions` verifizieren.
8. Production mit demselben Image-Digest promoten und Reconcile-/IAM-Smokes auswerten.

Rollback entfernt nur die neue Codeausführung. Additiv angelegte Permission-Definitionen und Grants werden nicht automatisch zurückgerollt; ein Entzug benötigt eine eigene fachlich freigegebene Migration.

## Verification

- Katalog-Eindeutigkeit und Root-/Tenant-Isolation
- Default-Grant an `system_admin` und explizite Opt-outs
- Core-Permission für neue und bestehende Tenants
- Modul-Permission bei Aktivierung und keine Definition-Löschung bei Deaktivierung
- Keine Änderung an Custom-Rollen, manuellen Grants oder Account-Rollenzuweisungen
- Wiederholter Reconcile ohne Dubletten oder unnötige Änderungen
- Gezielte Snapshot-Invalidierung und Audit-Evidenz
- Regression: `iam.accounts.delete` ist nach Baseline-Reconcile für `system_admin` effektiv
- Server-Runtime-, Unit-, Type-, Integrations-, Migrations- und PR-Gates gemäß Repository-Regeln

## Documentation

- ADR für Katalog und additiven Reconcile
- arc42 04, 05, 06, 08 und 09
- IAM-Autorisierungsmodell und Tenant-Bootstrap-Guide
- Studio-Rollout-Prozess nur ergänzen, wenn der Reconcile dort als Schritt des bestehenden kanonischen Pfads präzisiert werden muss; kein alternativer Deploypfad

## Open Questions

- Keine offenen fachlichen Fragen. Tenantweite Permissions erhalten standardmäßig `system_admin`; Moduldefinitionen werden spätestens bei Aktivierung materialisiert; Katalogentfernung ist nicht destruktiv.

