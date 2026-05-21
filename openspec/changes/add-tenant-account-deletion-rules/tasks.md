## 1. Fachliches Modell und Persistenz

- [x] 1.1 Tenantbezogene Löschregeln mit `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays`, Default-Inhaltsstrategie und Tenant-Schalter `allowContentPreferenceOverride` spezifizieren
- [x] 1.2 Baseline-Defaults/Fallbacks `90 / 180 / 365`, geerbte Default-Inhaltsstrategie `beibehalten` und den Default `allowContentPreferenceOverride = false` für neue oder noch nicht konfigurierte Tenants festlegen
- [x] 1.3 Die normative V1-Strategiemenge für Inhalte auf `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln` reduzieren und die zustandsbezogenen Effekte für `iam.contents` normieren
- [x] 1.4 Den Lebenszyklus für Tenant-Accounts mit `active`, `deactivated`, `pseudonymized` und `deleted` normieren
- [x] 1.5 Festlegen, dass `deactivated` nicht automatisch durch Login aufgehoben wird, dass spätere automatische Lifecycle-Stufen weiterlaufen dürfen und dass ein einzelner Lifecycle-Lauf einen Account höchstens um eine benachbarte Stufe weiterbewegt
- [x] 1.6 Festlegen, dass V1 Inaktivität ausschließlich aus `MAX(iam.activity_logs.created_at WHERE event_type = 'login')` ableitet und kein neues Aktivitäts-Tracking einführt
- [x] 1.7 Festlegen, dass Accounts ohne Login-Event in V1 nicht am automatischen Inaktivitäts-Lifecycle teilnehmen und dass Schwellwerte bei `last_login_at + N * 24h <= now()` erreicht sind
- [x] 1.8 Festlegen, dass `deleted` einen finalen Tombstone-Soft-Delete beschreibt und keine physische Löschung auslöst
- [x] 1.9 Den fachlichen Scope in V1 auf `iam.contents` als einzige Inhaltsdomäne begrenzen

## 2. Admin- und Self-Service-Oberflächen

- [x] 2.1 Einen neuen Tab `/admin/iam?tab=deletion-rules` für tenantbezogene Regelbearbeitung spezifizieren
- [x] 2.2 Im Admin-Tab Baseline-Defaults/Fallbacks gegenüber tenant-spezifischen Werten sichtbar machen und die zwei zulässigen Inhaltsstrategien plus Override-Schalter bearbeiten
- [x] 2.3 Transparente Anzeige der tenantweiten Regeln in `/account/privacy` spezifizieren
- [x] 2.4 Festlegen, dass Root-/Plattform-Admins ohne Tenant-Scope die Konten-Löschregeln-Box im Datenschutz-Cockpit nicht sehen
- [x] 2.5 Festlegen, dass Self-Service-Overrides nur für den eigenen Tenant-Account gespeichert werden dürfen und nur angezeigt werden, wenn der Tenant sie erlaubt
- [x] 2.6 Festlegen, dass die Self-Service-UI die wirksame Inhaltsregel direkt vorauswählt und keinen separaten `Tenant-Standard verwenden`-Platzhalter zeigt

## 3. Runtime und Lifecycle-Ausführung

- [x] 3.1 Tenant-Scope, Root-/Plattform-Ausschluss und Admin-Rollen-Gating für den Admin-Tab normieren
- [x] 3.2 Die serverseitige Validierung für streng aufsteigende Fristen und die zulässigen Inhaltsstrategien festlegen
- [x] 3.3 Den serverseitig aus Session/Auth-Kontext gebundenen Zielaccount für Self-Service-Overrides normieren
- [x] 3.4 Einen Runtime-/Ops-Einstieg für tenantweite Lifecycle-Läufe gegen dieselbe Login-Quelle wie die Read-Models ergänzen

## 4. Dokumentation und Nachweise

- [x] 4.1 Betroffene arc42-Abschnitte `05`, `08`, `10` und `11` für tenantbezogene Löschregeln aktualisieren
- [x] 4.2 Entwickler- und Betriebsdokumentation für Schema, Seeds, Read-Model und Lifecycle-Lauf ergänzen
- [x] 4.3 Testfälle für UI, Runtime, Governance-Read-Models, Lifecycle-Transitionen und Seed-/Schema-Pfade ableiten
- [x] 4.4 `openspec validate add-tenant-account-deletion-rules --strict` ausführen
