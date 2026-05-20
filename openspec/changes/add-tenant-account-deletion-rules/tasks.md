## 1. Fachliches Modell und Persistenz

- [ ] 1.1 Tenantbezogene Löschregeln mit `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` und Default-Inhaltsstrategie spezifizieren
- [ ] 1.2 Den Lebenszyklus für Tenant-Accounts mit `active`, `deactivated`, `pseudonymized` und `deleted` normieren
- [ ] 1.3 Festlegen, dass V1 Inaktivität ausschließlich aus `last_login_at` ableitet und kein neues Aktivitäts-Tracking einführt
- [ ] 1.4 Festlegen, dass `deleted` einen finalen Tombstone-Soft-Delete beschreibt und keine physische Löschung auslöst
- [ ] 1.5 Den fachlichen Scope in V1 auf `iam.contents` als einzige Inhaltsdomäne begrenzen

## 2. Admin- und Self-Service-Oberflächen

- [ ] 2.1 Einen neuen Tab `/admin/iam?tab=deletion-rules` für tenantbezogene Regelbearbeitung spezifizieren
- [ ] 2.2 Transparente Anzeige der tenantweiten Regeln in Account-/Privacy-Oberflächen spezifizieren
- [ ] 2.3 Einen per-Account-Override für die Behandlung eigener Inhalte im Self-Service spezifizieren
- [ ] 2.4 Leer-, Lade-, Fehler- und Zugriffsverweigerungszustände für die neuen UI-Flächen normieren

## 3. Governance, Berechtigungen und Lifecycle-Ausführung

- [ ] 3.1 Tenantgebundene Permissions für Lesen/Bearbeiten der Löschregeln spezifizieren
- [ ] 3.2 Eine explizite Permission für das manuelle oder geplante Ausführen des Account-Lifecycles spezifizieren
- [ ] 3.3 Cross-Tenant-, Root- und Plattform-Scope für dieses Feature normativ ausschließen
- [ ] 3.4 Validierungsregeln für geordnete Fristen und zulässige Inhaltsstrategien festlegen

## 4. Audit und Compliance

- [ ] 4.1 Revisionssichere Audit-Events für Regeländerungen spezifizieren
- [ ] 4.2 Revisionssichere Audit-Events für Lifecycle-Übergänge und Blockierungen spezifizieren
- [ ] 4.3 Revisionssichere Audit-Events für per-Account-Inhaltspräferenz-Overrides spezifizieren

## 5. Dokumentation und Nachweise

- [ ] 5.1 Betroffene arc42-Abschnitte `05`, `08`, `10` und `11` für tenantbezogene Löschregeln aktualisieren
- [ ] 5.2 Entwickler- und Betriebsdokumentation für Regelpflege, Lifecycle-Läufe und Audit-Nachweise ergänzen
- [ ] 5.3 Testfälle für UI, Governance, Lifecycle-Transitionen und Audit-Pfade ableiten
