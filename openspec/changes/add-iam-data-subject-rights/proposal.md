# Change: DSGVO-Betroffenenrechte im IAM

## Why

Die DSGVO (Art. 15–21) verlangt technische Mechanismen zur Umsetzung von Betroffenenrechten: Auskunft, Löschung, Berichtigung, Datenportabilität und Widerspruch. Diese Rechte betreffen direkt das IAM-Datenmodell (Accounts, Organisationszuordnungen, Audit-Logs) und müssen vor einem produktiven Rollout implementiert sein.

Die verbindlichen Anforderungen aus `Sicherheit-Datenschutz.md` (§7) definieren konkrete Messkriterien:
- Account-Löschung innerhalb 48 Stunden
- Self-Service-Portal für Betroffenenrechte
- Datenexport in 3 Formaten (JSON, XML, CSV)
- 100% der DSGVO-Betroffenenrechte implementiert

## Kontext

Child F ergänzt das IAM-Programm um die DSGVO-Compliance-Schicht. Dieser Change kann parallel zu Child D/E vorbereitet werden, da er primär auf dem stabilen Datenmodell aus Child B aufbaut. Die Governance-Workflows (Child E) liefern ergänzende Audit-Infrastruktur, sind aber kein harter Blocker für die Grundfunktionalität.

## What Changes

- Implementierung des Rechts auf Auskunft (Art. 15 DSGVO)
- Implementierung des Rechts auf Löschung / „Recht auf Vergessenwerden" (Art. 17 DSGVO)
- Implementierung des Rechts auf Berichtigung (Art. 16 DSGVO)
- Implementierung des Rechts auf Datenportabilität (Art. 20 DSGVO)
- Implementierung des Rechts auf Einschränkung der Verarbeitung (Art. 18 DSGVO)
- Implementierung der Mitteilungspflicht bei Berichtigung/Löschung/Einschränkung (Art. 19 DSGVO)
- Implementierung des Rechts auf Widerspruch (Art. 21 DSGVO)
- Löschkonzepte mit konfigurierbaren Aufbewahrungsfristen
- Berücksichtigung von Legal Holds bei Löschungen

### In Scope

- Datenexport-Endpunkt für Benutzer (JSON, XML, CSV)
- Account-Löschung mit Soft-Delete, Sperrung und endgültiger Löschung nach konfigurierbarer Frist
- Löschkaskaden für abhängige IAM-Daten (Organisationszuordnungen, Rollenzuweisungen)
- Anonymisierung statt Löschung für Statistik-relevante Daten
- Audit-Log-Handling bei Löschung (Pseudonymisierung, Legal Hold)
- API-Endpunkte für Self-Service-Betroffenenrechte
- Admin-Endpunkte für manuelle Bearbeitung von Betroffenenanfragen

### Out of Scope

- Fachmodulspezifische Löschkaskaden (News, Events, Media – gehören in modulspezifische Changes)
- Verfahrensverzeichnis-Generierung (Art. 30 DSGVO – separates Thema)
- Consent-Management / Cookie-Banner (Frontend-Thema)
- Datenschutzfolgenabschätzung (DSFA – organisatorischer Prozess)

### Delivery-Slices

1. **Export Slice:** Datenexport-API für Benutzer (JSON, CSV, XML)
2. **Lösch Slice:** Soft-Delete, Sperrung, konfigurierbare Fristen, Löschkaskaden
3. **Anonymisierung Slice:** Pseudonymisierung bei Löschung, Audit-Log-Bereinigung
4. **Self-Service Slice:** API-Endpunkte für Betroffenenanfragen
5. **Admin Slice:** Admin-Oberfläche für manuelle Bearbeitung + Legal Hold

## Impact

- Affected specs: `iam-data-subject-rights` (neu), `iam-core`, `iam-auditing`
- Affected code: `packages/core`, `packages/data`, `apps/studio`
- Affected arc42 sections: `08-cross-cutting-concepts`, `10-quality-requirements`

## Dependencies

- Requires: `add-iam-core-data-layer` (stabiles Datenmodell)
- Soft-Dependency: `add-iam-governance-workflows` (Audit-Infrastruktur, Legal Hold)

## Risiken und Gegenmaßnahmen

- **Unvollständige Löschkaskaden:** vollständige Auflistung aller IAM-Daten pro Account + Integrationstests
- **Audit-Logs nach Löschung:** Pseudonymisierung statt Löschung für Audit-Einträge; Legal Hold verhindert Löschung bei laufenden Verfahren
- **Backup-Konsistenz:** Löschung muss auch in Backup-Strategie berücksichtigt werden (dokumentieren)
- **Fristüberschreitung:** Monitoring für offene Löschanfragen mit Eskalation bei Fristüberschreitung

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ⬜ Child-B-Datenmodell für Accounts und Organisationen stabil
2. ⬜ Löschfristen mit DSB/Legal abgestimmt (Standard-Frist + Ausnahmen)
3. ⬜ Anonymisierungsstrategie für Audit-Logs bei Account-Löschung definiert
4. ⬜ Legal-Hold-Prozess mit Legal abgestimmt

## Akzeptanzkriterien (Change-Ebene)

- Benutzer können ihre vollständigen IAM-Daten als JSON, CSV oder XML exportieren.
- Account-Löschung erfolgt als Soft-Delete mit konfigurierbarer Frist bis zur endgültigen Löschung.
- Löschkaskaden entfernen alle zugehörigen IAM-Daten (Organisationszuordnungen, Rollenzuweisungen).
- Audit-Logs werden bei Account-Löschung pseudonymisiert (nicht gelöscht), außer bei Legal Hold.
- Legal Holds verhindern die Löschung betroffener Daten bis zur Aufhebung.
- Offene Löschanfragen mit Fristüberschreitung werden automatisch eskaliert.
- Alle Betroffenenanfragen erzeugen unveränderbare Audit-Events.

## Status

🟡 Draft Proposal (neu angelegt aus Security-Review-Befund R2)
