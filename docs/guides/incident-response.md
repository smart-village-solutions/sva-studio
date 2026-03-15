# Incident Response

Dieses Dokument beschreibt den verbindlichen Ablauf für betriebliche Störungen und sicherheitsnahe Vorfälle in SVA Studio.

## Ziele

- Auswirkungen für Nutzerinnen und Nutzer schnell begrenzen
- klare Eskalationswege und Zuständigkeiten herstellen
- sensible Informationen nicht in öffentliche Kanäle leaken
- belastbare Nachverfolgung und Learnings sicherstellen

## Meldewege

| Fall | Primärer Kanal | Zusatzkanal |
| --- | --- | --- |
| allgemeiner Incident oder Betriebsstörung | `operations@smart-village.app` | GitHub Issue erst nach Bereinigung sensibler Details |
| Sicherheitsbezug oder möglicher Datenschutzvorfall | `security@smart-village.app` | zusätzlich `operations@smart-village.app` |
| nicht-sensitive Nachverfolgung, Dokumentation, Maßnahmen | GitHub Issues | optional Verweis auf interne Incident-Referenz |

## Schweregrade

| Stufe | Beschreibung | Beispiele | Ziel für Erstreaktion |
| --- | --- | --- | --- |
| P1 | Kritischer Ausfall oder aktiver Sicherheitsvorfall | Login komplett gestört, produktive Daten gefährdet, großflächiger Totalausfall | sofort, höchstens 30 Minuten |
| P2 | Hohe Beeinträchtigung eines Kernprozesses | Teilfunktion ausgefallen, Monitoring blind, Rollout blockiert | höchstens 2 Stunden |
| P3 | Begrenzte Beeinträchtigung mit Workaround | einzelne Route betroffen, degradierte Performance | innerhalb eines Arbeitstags |
| P4 | geringe Auswirkung oder Präventionsmaßnahme | Dokumentationslücke, kleiner Alert ohne Nutzerwirkung | geplant im normalen Arbeitsfluss |

## Rollen im Incident

| Rolle | Verantwortung |
| --- | --- |
| Incident Lead | priorisiert Maßnahmen, hält Status und Entscheidungen zusammen |
| Fachverantwortung | liefert System- oder Domänenwissen für betroffene Komponente |
| Kommunikation | hält Stakeholder-Update, Release-Kommunikation und Nachverfolgung konsistent |
| Dokumentation | sammelt Timeline, Entscheidungen, Evidenz und Folgearbeiten |

Eine Person kann mehrere Rollen gleichzeitig übernehmen, solange die Entscheidungs- und Kommunikationsverantwortung klar bleibt.

## Ablauf

### 1. Erkennen und Einstufen

- Eingang über Monitoring, E-Mail, Tests oder manuelle Meldung
- P1 bis P4 einstufen
- festhalten, welches Profil betroffen ist: lokal, Demo oder Referenzprofil

### 2. Eindämmen

- schadhafte Änderung stoppen oder rückgängig machen
- wenn nötig Traffic begrenzen, Deployment pausieren oder letzten stabilen Stand wiederherstellen
- sensible Daten nur in privaten Kanälen teilen

### 3. Analyse und Behebung

- Timeline mit Zeitpunkten, Symptomen und Maßnahmen führen
- Ursachenhypothesen priorisieren
- Fix, Mitigation oder Rollback umsetzen
- bei Daten- oder Sicherheitsbezug `security@smart-village.app` aktiv einbinden

### 4. Verifikation und Recovery

- Smoke-Checks und relevante Tests erneut ausführen
- Monitoring auf Stabilität prüfen
- Abschlusszeitpunkt und verbleibende Restrisiken dokumentieren

### 5. Nachbereitung

- nicht-sensitive Folgearbeiten als GitHub Issues anlegen
- Runbooks, Guides oder Architektur-Doku aktualisieren
- bei P1 oder P2 eine kurze Nachbesprechung und Maßnahmenliste dokumentieren

## Kommunikationsregeln

- Keine sensiblen Details in öffentliche GitHub Issues, PRs oder Commits.
- Öffentliche Kommunikation nennt Wirkung, Status und nächste Schritte, aber keine ausnutzbaren Details.
- Sicherheits- oder Datenschutzbezug wird immer zuerst privat behandelt.

## Evidenz und Mindestinhalt

Für jeden relevanten Incident mindestens festhalten:

- Startzeitpunkt, Erkennungszeitpunkt und Recovery-Zeitpunkt
- betroffene Systeme, Routen oder Daten
- Schweregrad P1 bis P4
- getroffene Maßnahmen und Entscheidungen
- offene Folgearbeiten

## Beziehung zu Betriebszielen

Die aktuellen Zielwerte aus dem Swarm-Runbook bleiben verbindlich:

- App und Monitoring: `RTO <= 2h`
- IAM- und Postgres-Daten: `RPO <= 24h`

Wenn diese Zielwerte verfehlt werden, muss das in der Nachbereitung explizit benannt werden.

## Verweise

- Security Policy: `./security-policy.md`
- Deployment-Runbook: `./swarm-deployment-runbook.md`
- Deployment-Überblick: `./deployment-overview.md`
- Troubleshooting: `./troubleshooting.md`
