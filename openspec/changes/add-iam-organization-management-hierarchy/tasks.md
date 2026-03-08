# Tasks: add-iam-organization-management-hierarchy

## 1. Datenmodell

- [ ] 1.1 Hierarchische Organisationsfelder und Constraints im `iam`-Schema definieren
- [ ] 1.2 Organisationstypen und organisationsbezogene Basispolicies für `iam.organizations` festlegen
- [ ] 1.3 Mehrfach-Zugehörigkeit von Accounts zu Organisationen fachlich und technisch absichern
- [ ] 1.4 Membership-Metadaten für Default-Kontext und interne/externe Zuordnung festlegen
- [ ] 1.5 Migrationspfad für bestehende `iam.organizations`- und `iam.account_organizations`-Daten festlegen
- [ ] 1.6 Seeds für Organisationsbasisdaten, Typen und Testkonstellationen ergänzen

## 2. Backend-API

- [ ] 2.1 Read-Model für Organisationsliste, Detail und Hierarchiereferenz definieren
- [ ] 2.2 Organisations-CRUD-Endpunkte inklusive Typ- und Policy-Felder spezifizieren
- [ ] 2.3 Endpunkte für Account-zu-Organisation-Zuordnung und -Entzug spezifizieren
- [ ] 2.4 Sessionsbasierten Contract für Lesen und Setzen des aktiven Organisationskontexts spezifizieren
- [ ] 2.5 Instanz- und Validierungsregeln für Organisationszugriffe definieren
- [ ] 2.6 Testmatrix für Scope-, Konflikt-, Kontext- und Validierungsfälle ergänzen

## 3. Admin-UI

- [ ] 3.1 Organisationsverwaltungsseite unter `/admin/organizations` spezifizieren
- [ ] 3.2 Organisationsliste mit Suche, Filter und einfacher Strukturansicht spezifizieren
- [ ] 3.3 Detail-/Bearbeitungsansicht für Organisationen inklusive Typ und Policy spezifizieren
- [ ] 3.4 UI für Account-Zuordnungen zu Organisationen inklusive Default-Kontext und interner/externer Kennzeichnung spezifizieren
- [ ] 3.5 UI-Komponente für Org-Kontextwechsel bei Multi-Org-Accounts spezifizieren
- [ ] 3.6 Accessibility- und i18n-Anforderungen für die neuen Views ergänzen

## 4. Sicherheit und Mandantenfähigkeit

- [ ] 4.1 RLS- und Service-Guard-Anforderungen für Organisationszugriffe dokumentieren
- [ ] 4.2 Validierungsregeln gegen Zyklen und instanzfremde Parent-/Child-Referenzen festlegen
- [ ] 4.3 Regeln für zulässige Org-Kontextwechsel serverseitig festlegen
- [ ] 4.4 CSRF-Anforderungen für mutierende Organisations- und Kontext-Endpunkte spezifizieren
- [ ] 4.5 Audit- und Logging-Anforderungen mit SDK-Logger, Pflichtfeldern und PII-Redaction festlegen
- [ ] 4.6 Deaktivierungsregeln für Organisationen mit bestehenden Abhängigkeiten festlegen und physischen Delete explizit aus dem ersten Schnitt ausschließen

## 5. UI-Qualität und Nutzbarkeit

- [ ] 5.1 Vollständige i18n-Abdeckung ohne hardcodierte UI-Texte für Organisations-Views und Org-Switcher festlegen
- [ ] 5.2 Accessibility-Anforderungen nach WCAG 2.1 AA für Dialoge, Tabellen, Filter und Kontextwechsel festlegen
- [ ] 5.3 Responsive-Anforderungen für 320 px, 768 px und 1024 px dokumentieren

## 6. Qualität, Dokumentation und Verifikation

- [ ] 6.1 Betroffene arc42-Abschnitte referenzieren und Aktualisierungsbedarf dokumentieren
- [ ] 6.2 API-/Datenmodell-Beispiele für Organisationstypen, Policies und Org-Kontext in den Specs ergänzen
- [ ] 6.3 Test- und Qualitätsnachweise für Unit-, Type-, Lint-, Coverage- und relevante Integrationsläufe festlegen
- [ ] 6.4 Rollback-Nachweis für Up-/Down-Migrationen explizit verlangen
- [ ] 6.5 Die Abgrenzung zu späterer Hierarchie-Vererbung, Org-Admin-Policies, Request-Overrides und Beitrittsprozessen explizit dokumentieren
- [ ] 6.6 Die Entscheidungen zu `DELETE = Deaktivierung`, sessionsbasiertem Org-Kontext und `content_author_policy` als einziger Basispolicy in Proposal/Design/Specs synchron halten
- [ ] 6.7 `openspec validate add-iam-organization-management-hierarchy --strict` erfolgreich ausführen

## 7. Nicht-Ziele des ersten Schnitts

- [ ] 7.1 Hierarchie-Vererbung im Authorize-Pfad explizit als Folgearbeit abgrenzen
- [ ] 7.2 Delegierbare Org-Administration und Beitritts-/Bewerbungsprozesse explizit als Folgearbeit abgrenzen
- [ ] 7.3 Vollständige Branding-/White-Label-Konfiguration explizit als Folgearbeit abgrenzen
- [ ] 7.4 Request-basierte Org-Kontext-Overrides explizit als Folgearbeit abgrenzen
