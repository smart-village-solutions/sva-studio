## 1. Fachliches Modell und Persistenz

- [ ] 1.1 Tenantbezogene Löschregeln mit `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` und der normativen V1-Strategiemenge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln` spezifizieren
- [ ] 1.1.1 Normative Baseline-Defaults/Fallbacks `90 / 180 / 365` und die geerbte Default-Inhaltsstrategie `beibehalten` für neue oder noch nicht konfigurierte Tenants festlegen
- [ ] 1.1.2 Die fachliche Bedeutung der vier V1-Inhaltsstrategien für `iam.contents` mit konkreten Zustandsübergängen, Pseudonym-Labels und Tombstone-Effekten normieren
- [ ] 1.2 Den Lebenszyklus für Tenant-Accounts mit `active`, `deactivated`, `pseudonymized` und `deleted` normieren
- [ ] 1.2.1 Festlegen, dass `deactivated` nicht automatisch durch Login aufgehoben wird, sondern einen separaten Reaktivierungsprozess verlangt
- [ ] 1.2.2 Festlegen, dass ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterlaufen dürfen
- [ ] 1.3 Festlegen, dass V1 Inaktivität ausschließlich aus `last_login_at` ableitet und kein neues Aktivitäts-Tracking einführt
- [ ] 1.3.1 Festlegen, dass V1 ausschließlich das persistierte Feld `last_login_at` des Tenant-Account-Records als kanonische Quelle für Online- und Offline-Auswertung verwendet und nicht tenantübergreifend interpretiert
- [ ] 1.3.2 Festlegen, dass Accounts mit `last_login_at = null` in V1 nicht am automatischen Inaktivitäts-Lifecycle teilnehmen und dass Schwellwerte bei `last_login_at + N * 24h <= now()` erreicht sind
- [ ] 1.3.3 Festlegen, dass Accounts mit `last_login_at = null` auch durch manuelle Läufe dieses Deletion-Rules-Mechanismus nicht verarbeitet werden und außerhalb dieses V1-Features separat administriert werden müssen
- [ ] 1.4 Festlegen, dass `deleted` einen finalen Tombstone-Soft-Delete beschreibt und keine physische Löschung auslöst
- [ ] 1.5 Den fachlichen Scope in V1 auf `iam.contents` als einzige Inhaltsdomäne begrenzen
- [ ] 1.5.1 Die Weiterführung von `iam.contents` durch spätere Account-Stufen je Inhaltsstrategie normieren

## 2. Admin- und Self-Service-Oberflächen

- [ ] 2.1 Einen neuen Tab `/admin/iam?tab=deletion-rules` für tenantbezogene Regelbearbeitung spezifizieren
- [ ] 2.1.1 Im Admin-Tab Baseline-Defaults/Fallbacks gegenüber tenant-spezifischen Werten sichtbar machen
- [ ] 2.1.2 Für unkonfigurierte Tenants normieren, dass die UI geerbte Defaults als wirksamen Zustand zeigt und Speichern eine explizite Tenant-Konfiguration erzeugt
- [ ] 2.1.3 Read-only-Verhalten für `iam.deletionRules.read` ohne `iam.deletionRules.manage` normieren
- [ ] 2.2 Transparente Anzeige der tenantweiten Regeln in Account-/Privacy-Oberflächen spezifizieren
- [ ] 2.3 Einen per-Account-Override für die Behandlung eigener Inhalte im Self-Service spezifizieren
- [ ] 2.3.1 Festlegen, dass Self-Service-Overrides nur für den eigenen Tenant-Account und ohne Admin-Cross-User-Schreibpfad gespeichert werden dürfen
- [ ] 2.4 Lade-, Fehler-, Read-only- und Zugriffsverweigerungszustände für die neuen UI-Flächen normieren und Leerstates für unkonfigurierte Tenants durch wirksame Baseline-Defaults ersetzen

## 3. Governance, Berechtigungen und Lifecycle-Ausführung

- [ ] 3.1 Tenantgebundene Permissions für Lesen/Bearbeiten der Löschregeln spezifizieren
- [ ] 3.2 Eine explizite Permission für das manuelle oder geplante Ausführen des Account-Lifecycles spezifizieren
- [ ] 3.2.1 Für geplante Läufe eine dedizierte tenantgebundene technische Service-Identität mit expliziter `iam.accountLifecycle.run`-Vergabe pro `instanceId` normieren
- [ ] 3.3 Cross-Tenant-, Root- und Plattform-Scope für dieses Feature normativ ausschließen
- [ ] 3.4 Validierungsregeln für geordnete Fristen und die zulässigen V1-Inhaltsstrategien `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln` festlegen
- [ ] 3.4.1 Den serverseitig aus Session/Auth-Kontext gebundenen Zielaccount für Self-Service-Overrides normieren

## 4. Audit und Compliance

- [ ] 4.1 Revisionssichere Audit-Events für Regeländerungen spezifizieren
- [ ] 4.2 Revisionssichere Audit-Events für Lifecycle-Übergänge und Blockierungen spezifizieren
- [ ] 4.3 Revisionssichere Audit-Events für per-Account-Inhaltspräferenz-Overrides spezifizieren
- [ ] 4.4 Einen gemeinsamen Mindestvertrag für Audit-Events von Regeländerungen, Overrides, Lifecycle-Übergängen und Blockierungen normieren
- [ ] 4.4.1 Pflichtfelder, zulässige `result`-Werte und normative Event-Familien für den Auditvertrag festlegen
- [ ] 4.4.2 Die Semantik von `applied`, `blocked` und `rejected` einschließlich Erst-Save-Payloads aus geerbtem Wirkszustand normieren

## 5. Dokumentation und Nachweise

- [ ] 5.1 Betroffene arc42-Abschnitte `05`, `08`, `10` und `11` für tenantbezogene Löschregeln aktualisieren
- [ ] 5.2 Entwickler- und Betriebsdokumentation für Regelpflege, Lifecycle-Läufe und Audit-Nachweise ergänzen
- [ ] 5.3 Testfälle für UI, Governance, Lifecycle-Transitionen und Audit-Pfade ableiten
