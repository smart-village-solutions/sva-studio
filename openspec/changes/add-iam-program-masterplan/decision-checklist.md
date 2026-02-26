# IAM Entscheidungs-Checkliste (Must / Should / Could)

Ziel: Vor Umsetzung der Child-Changes die wesentlichen Architektur-, Security- und Betriebsentscheidungen verbindlich festlegen.

## Nutzung

- Pro Punkt genau eine Entscheidung dokumentieren.
- Offene Punkte mit Owner und Fälligkeitsdatum versehen.
- Master-Change gilt erst als umsetzungsbereit, wenn alle **Must**-Punkte entschieden sind.

---

## Must (vor Start Child A/B)

### 1) Zielumfang Phase 1
- Entscheidung: [ ] Nur Auth + Session + RBAC-Basis
- Entscheidung: [ ] Zusätzlich Multi-Org-Context-Switch
- Entscheidung: [ ] Sonstiges: ____________________
- Owner: ____________________
- Fällig am: ____________________

### 2) Verbindliche Rollenmatrix (7 Personas)
- Liegt eine freigegebene Rechte-Matrix pro Persona vor (CRUD, Approve, Admin, Export)?
- Entscheidung: [ ] Ja, freigegeben
- Entscheidung: [ ] Nein, bis Datum finalisieren
- Referenz-Dokument: ____________________
- Owner: ____________________

### 3) Tenant-Kanon und Hierarchie
- Kanonischer Scope: [ ] organizationId [ ] tenantId [ ] workspaceId
- Hierarchietiefe: [ ] 3 Ebenen fix [ ] beliebig tief
- Cross-Tenant-Ausnahmen erlaubt: [ ] Nein [ ] Ja, nur für ____________________
- Owner: ____________________

### 4) Security-Gates
- Impersonation verpflichtend mit:
  - [ ] Ticketpflicht
  - [ ] Vier-Augen-Freigabe
  - [ ] Maximaldauer (Minuten/Stunden): ____________________
- PII in Logs:
  - [ ] strikt minimiert/pseudonymisiert
  - [ ] partiell sichtbar (welche Felder): ____________________
- Owner (Security): ____________________

### 5) Compliance-Vorgaben
- Audit-Retention: ____________________
- Lösch-/Sperrregeln (DSGVO): ____________________
- Nachweisformat für Audits: [ ] CSV [ ] JSON [ ] SIEM-Export
- Owner (Legal/DSB): ____________________

### 6) Performance- und Lastziele
- `authorize`-SLO: [ ] P95 < 50 ms [ ] P99 < 50 ms [ ] anderer Wert: ____________________
- Lastprofil (RPS, Concurrent Users, Peak): ____________________
- Owner (Plattform): ____________________

### 7) Eventing-Entscheidung für Cache-Invalidierung
- Primär: [ ] Postgres NOTIFY [ ] Redis Streams [ ] Broker (NATS/Kafka)
- Fallback-Strategie: ____________________
- Owner (Architektur): ____________________

### 8) Rollout-Strategie
- Rollout: [ ] Feature-Flags stufenweise [ ] Big Bang
- Parallelbetrieb Altpfad bis: ____________________
- Harte Go-Live-Kriterien: ____________________
- Owner (Produkt): ____________________

---

## Should (vor Start Child C/D)

### 9) ABAC-Attributkatalog
- Pflichtattribute (z. B. Org, Geo, Zeitfenster, Acting-As) final definiert?
- Entscheidung: [ ] Ja [ ] Nein
- Owner: ____________________

### 10) Entscheidungsbegründungen (`reason`-Codes)
- Standardisierte Denial-/Allow-Gründe freigegeben?
- Entscheidung: [ ] Ja [ ] Nein
- Owner: ____________________

### 11) Betriebs- und Incident-Prozesse
- On-Call, Alarmierung, Runbook für IAM-Ausfälle definiert?
- Entscheidung: [ ] Ja [ ] Nein
- Owner: ____________________

### 12) Datenmigration
- Migrationsstrategie für Bestandsnutzer und Rollen final?
- Entscheidung: [ ] Ja [ ] Nein
- Owner: ____________________

---

## Could (für Reifegrad nach Go-Live)

### 13) Policy-Simulation / Dry-Run
- Vorab-Prüfung von Policy-Änderungen ohne produktive Wirkung
- Entscheidung: [ ] Geplant [ ] Nicht geplant

### 14) Self-Service Rollenberichte
- Organisationen können eigene Rollen-/Rechteberichte exportieren
- Entscheidung: [ ] Geplant [ ] Nicht geplant

### 15) Realtime Permission Prewarming
- Proaktives Neuaufbauen kritischer Permission-Snapshots
- Entscheidung: [ ] Geplant [ ] Nicht geplant

---

## Abschlusskriterium Masterplan

Master-Change kann in „bereit zur Umsetzung“ überführt werden, wenn:
- alle **Must**-Punkte entschieden sind,
- Owner benannt sind,
- und offene **Should**-Punkte mit Termin im jeweiligen Child-Change verankert wurden.
