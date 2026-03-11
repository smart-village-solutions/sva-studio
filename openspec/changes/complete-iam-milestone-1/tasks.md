# Tasks: complete-iam-milestone-1

## 1. OIDC-, Client- und Token-Vertrag

- [ ] 1.1 Verbindliche Keycloak-Client-Topologie für CMS, App und IAM-Service festlegen
- [ ] 1.2 OIDC-Claim- und Token-Vertrag für `sub`, `instanceId`, Rollen, Organisationskontext und Rückkehrpfade spezifizieren
- [ ] 1.3 Einheitlichen Login für CMS und App mit gemeinsamem IdP-Session-Verhalten spezifizieren
- [ ] 1.4 Sicherheits- und Rotationsanforderungen für Client-Secrets, Redirect-URIs und Token-Lebensdauern dokumentieren

## 2. Account-Lifecycle und Governance

- [ ] 2.1 Nutzertypen `internal` und `external` fachlich und technisch definieren
- [ ] 2.2 Einladungs-, Onboarding- und Schulungsbestätigungs-Workflow spezifizieren
- [ ] 2.3 Offboarding-Workflow für Statuswechsel, Rollenzugriff, Session-Revocation und Audit-Nachweise spezifizieren
- [ ] 2.4 Temporäre Vertretungsrechte mit Start-/Enddatum und nachvollziehbarer Freigabe spezifizieren

## 3. Rollen, Gruppen und Berechtigungsmodell

- [ ] 3.1 Gruppenmodell `iam.groups` und Membership-Zuordnungen spezifizieren
- [ ] 3.2 Strukturierte, fein granulare Permission-Felder inklusive `effect`, `scope`, `resource_type` und optionalem `resource_id` vervollständigen
- [ ] 3.3 Wechselwirkungen von Rollen, Gruppen, Delegationen und Org-/Geo-Kontext in der effektiven Berechtigungsberechnung definieren
- [ ] 3.4 Zuweisungs- und Konfliktregeln für Systemrollen, Custom-Rollen und gruppenvermittelte Rechte dokumentieren

## 4. Permission Engine und Performance

- [ ] 4.1 Snapshot-Key um Org-, Geo- und Versionssignale präzisieren
- [ ] 4.2 Invalidation-Regeln für Rollen-, Gruppen-, Membership-, Delegations- und Hierarchieänderungen definieren
- [ ] 4.3 Lastprofil und Performance-Nachweis für Cache-Hit und Cache-Miss inklusive Zielmetriken festlegen
- [ ] 4.4 Monitoring-, Logging- und Alerting-Anforderungen für die Authorize-Strecke ergänzen

## 5. Organisationen und Mandantenfähigkeit

- [ ] 5.1 Mehrstufige Organisationstypen und Hierarchieregeln definieren
- [ ] 5.2 Beitrittsprinzip via Einladung oder Bewerbung spezifizieren
- [ ] 5.3 Privacy-Optionen für Namensnennung vs. Anonymität modellieren
- [ ] 5.4 Delegierbare Administration und ihre Leitplanken auf Daten- und UI-Ebene spezifizieren

## 6. Audit, Datenschutz und Compliance

- [ ] 6.1 Unveränderliche Auditspur für Rechte-, Gruppen-, Delegations- und Offboarding-Ereignisse spezifizieren
- [ ] 6.2 Exportverträge für CSV/JSON und DSGVO-Auskunft vervollständigen
- [ ] 6.3 Erinnerungs- und Review-Mechanismen für Accounts, Rechte und Inhalte spezifizieren
- [ ] 6.4 Datenlöschkonzept inklusive Pseudonymisierung, Archivierung und Retention-Abgrenzung festlegen

## 7. Verwaltungs-UI

- [ ] 7.1 Admin-UI-Anforderungen für Rollen-, Gruppen- und Membership-Verwaltung schärfen
- [ ] 7.2 UI-Flows für Onboarding-Status, Offboarding und Delegationen spezifizieren
- [ ] 7.3 Accessibility-, i18n- und Zustandskommunikation für neue IAM-Ansichten definieren

## 8. Qualität, Tests und Dokumentation

- [ ] 8.1 Testmatrix für OIDC, Lifecycle, Gruppen, Permission Engine, Audit und UI ergänzen
- [ ] 8.2 Betroffene arc42-Abschnitte referenzieren und Aktualisierungsbedarf dokumentieren
- [ ] 8.3 Relevante Runbooks und Betriebsdokumentation als Folgearbeit referenzieren
- [ ] 8.4 `openspec validate complete-iam-milestone-1 --strict` erfolgreich ausführen
