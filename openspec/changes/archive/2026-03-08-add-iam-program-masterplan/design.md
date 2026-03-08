# Design: IAM-Programmsteuerung über Master- und Child-Changes

## Kontext

Das Ziel-IAM umfasst Identität, Mandantenfähigkeit, Berechtigungslogik, Workflows und Compliance. Diese Domänen haben unterschiedliche Risiken, Datenabhängigkeiten und Testanforderungen. Um Architekturqualität und Lieferfähigkeit zu sichern, wird ein Programm-Design über OpenSpec benötigt.

## Ziele / Non-Ziele

### Ziele

- Gesamtvorhaben in unabhängige, reviewbare Umsetzungspakete zerlegen
- Reihenfolge über technische Abhängigkeiten steuern
- Risiken früh kapseln (Security, Datenmodell, Cache-Konsistenz)
- Pro Child-Change klare Akzeptanz- und Exit-Kriterien definieren

### Non-Ziele

- Keine fachliche Detail-Spezifikation aller Child-Changes in diesem Dokument
- Keine direkte Implementierung von IAM-Features im Master-Change

## Architektur- und Planungsentscheidungen

### 1) Hierarchisches Change-Modell

- Master-Change: Programmrahmen, Governance, Sequenzierung
- Child-Changes: konkrete Anforderungen, Deltas, Tasks, Implementierung

**Rationale:**
- reduziert PR-Größe und Review-Rauschen
- verbessert Rückverfolgbarkeit
- erlaubt stufenweise Freigaben

### 2) Datenmodell vor Policy-Engine

Reihenfolge:
1. Identity-Basis
2. Core Data Layer
3. RBAC v1
4. ABAC + Hierarchie + Cache
5. Governance-Workflows
6. DSGVO-Betroffenenrechte (kann parallel zu 4/5 vorbereitet werden)

**Rationale:**
- RBAC/ABAC benötigen stabile Entitäten (`accounts`, `organizations`, `roles`, `permissions`)
- Cache-Strategien sind erst mit belastbarer Authorize-API sinnvoll

### 3) Security by Design als Gate

Jeder Child-Change muss explizit enthalten:
- Threat-/Abuse-Betrachtung
- Auditierbarkeit
- Tests für Negativpfade

## Risiken und Mitigation

- **Scope Creep:** harte Abgrenzung je Child-Change, Non-Goals verpflichtend
- **Diff-Rauschen:** kleine PRs, klare Target-Branches bei Stacks
- **Performance-Risiko:** Messpunkte und SLOs bereits in RBAC/ABAC-Changes verankern
- **Compliance-Lücken:** Audit/Legal explizit als eigener Child-Change; DSGVO-Betroffenenrechte als separater Child-Change (Child F) verankert
- **PII-Risiko:** Pseudonymisierungsstrategie als Programm-Leitplanke verankert (kein Klartext-PII in Audit-Details)

## Migrationsstrategie

- Feature-Flags für schrittweise Aktivierung
- Parallelbetrieb bestehender Auth-Bausteine bis IAM-Authorize stabil ist
- Retargeting der Child-PRs entlang der Branch-Kette

## Offene Fragen

- Welche Teile von `setup-iam-identity-auth` werden als Child A unverändert übernommen, welche in Child B/C verschoben?
- Welches Zielbild gilt für Eventing (Postgres NOTIFY vs. Broker) im Cache-Invalidierungs-Flow?
- ~~Welche Mindest-Retention gilt für `iam.activity_logs` in Phase 1 vs. Endausbau?~~ **Entschieden: 24 Monate, konfigurierbar (Beschluss 26.02.2026)**

## Explizit deferred (außerhalb Programm-Scope)

Folgende Punkte werden bewusst auf einen späteren Zeitpunkt nach der IAM-Kernentwicklung verschoben:

- **Keycloak-Härtung:** MFA-Enforcement, Passwortrichtlinien (BSI: 12 Zeichen, Komplexität, 90-Tage-Ablauf), Session-Idle-Timeout (30 Min), Account-Lockout (5 Fehlversuche), Rate-Limiting, Brute-Force-Detection
- **Keycloak-Version:** Festlegung auf eine spezifische LTS-Version erfolgt, wenn Produktivbetrieb geplant wird
- **SAST/DAST/Container-Scans:** Werden im CI-Pipeline-Kontext separat adressiert (siehe GitHub Issue SBOM-Generierung)
