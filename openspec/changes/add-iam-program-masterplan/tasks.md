# Tasks: add-iam-program-masterplan

## 1. Programmrahmen definieren

- [x] 1.1 Child-Change-Liste finalisieren (IDs, Scope, Reihenfolge)
- [x] 1.2 Abhängigkeiten und Schnittstellen zwischen Child-Changes dokumentieren
- [x] 1.3 Exit-Kriterien pro Child-Change festlegen
- [x] 1.4 Entscheidungs-Checkliste in `decision-checklist.md` vollständig ausfüllen und freigeben
- [x] 1.5 Kanonischen Mandanten-Scope `instanceId` festlegen (inkl. Instanz→Organisation-Modell)

## 2. Bestehenden IAM-Change einordnen

- [x] 2.1 `setup-iam-identity-auth` als Child A klassifizieren
- [x] 2.2 Scope-Bereinigung durchführen (alles außerhalb Child A auslagern)
- [x] 2.3 Offene Punkte in Child-A-Backlog übernehmen

## 3. Child-Changes vorbereiten (Proposal-ready)

- [x] 3.1 `add-iam-core-data-layer` anlegen
- [x] 3.2 `add-iam-authorization-rbac-v1` anlegen
- [x] 3.3 `add-iam-abac-hierarchy-cache` anlegen
- [x] 3.4 `add-iam-governance-workflows` anlegen
- [x] 3.5 `add-iam-data-subject-rights` anlegen (DSGVO-Betroffenenrechte, Child F)

## 4. Architektur- und Qualitätsbezug absichern

- [x] 4.1 arc42-Abschnitte je Child-Change referenzieren
- [x] 4.2 Sicherheits- und Compliance-Anforderungen je Child-Change als Kriterien verankern
- [x] 4.3 Performance-Ziel (`authorize` < 50 ms) als messbares Kriterium verankern

## 5. Review-Gates

- [x] 5.1 Master-Change reviewen und freigeben (26.02.2026: Alle Must-Entscheidungen getroffen, Masterplan freigegeben)
- [x] 5.2 Child-Changes einzeln reviewen und freigeben (28.02.2026: Child A–F einzeln reviewed; Changes liegen archiviert mit abgeschlossenen Tasklisten vor)
- [x] 5.3 Implementierung erst nach Freigabe des jeweiligen Child-Changes starten (28.02.2026: Umsetzungspfad je Child nach Review-Gates dokumentiert und eingehalten)

## 6. Review-Befunde umsetzen (Architecture Review 26.02.2026)

### 6.1 Spec-Ownership und Konsistenz

- [x] 6.1.1 ~~Spec-Ownership-Modell klären~~ → Entschieden (26.02.2026): Jeder Child-Change besitzt seine eigenen Specs (Delta-Specs). Keine zentrale Base-Spec-Ablage in `openspec/specs/` für IAM. Bereits umgesetzt: Child A–F haben jeweils eigene `specs/`-Verzeichnisse.
- [x] 6.1.2 ~~ADR erstellen: „Spec-Ownership-Modell"~~ → Nicht als separater ADR nötig; Governance-Regel im Masterplan-Spec verankert (design.md-Pflicht + eigene Specs pro Child).
- [x] 6.1.3 Sprache der Specs vereinheitlichen: Base-Specs unter Child A sprachlich auf Deutsch vereinheitlicht (28.02.2026; priorisiert `iam-access-control`, `iam-auditing`)

### 6.2 Offene Entscheidungen absichern

- [x] 6.2.1 ~~Rollenmatrix (7 Personas) formal freigeben~~ → Entschieden (26.02.2026): Konkrete Rechte-Matrix ist Laufzeit-Konfiguration über SVA Studio, kein Architektur-Blocker. Vor Child C muss nur die Aggregationsregel (OR vs. AND) als ADR feststehen.
- [x] 6.2.2 ~~Supabase-Dependency-Grenze klären~~ → Entschieden (26.02.2026): Kein Supabase. Postgres lokal via Docker. Alle Referenzen bereinigt.
- [x] 6.2.3 ~~Keycloak-Version festlegen und als verbindlich in decision-checklist.md aufnehmen~~ → Deferred: Keycloak-Version wird festgelegt, wenn Produktivbetrieb geplant wird
- [x] 6.2.4 Audit-Retention auf 24 Monate bestätigt (konfigurierbar) – decision-checklist Punkt 5 aktualisiert
- [x] 6.2.5 PII-Pseudonymisierungsstrategie als Leitplanke verankert – decision-checklist Punkt 4 und Masterplan aktualisiert

### 6.3 arc42-Dokumentation

- [x] 6.3.1 arc42 `05-building-block-view` um IAM-Bausteine und Package-Zuordnung ergänzt (28.02.2026)
- [x] 6.3.2 arc42 `06-runtime-view` um OIDC-Flow, Authorize-Sequenz und Cache-Invalidierung ergänzt (28.02.2026)
- [x] 6.3.3 arc42 `07-deployment-view` um Keycloak, Postgres-Docker und Redis ergänzt (28.02.2026)
- [x] 6.3.4 arc42 `08-cross-cutting-concepts` um Multi-Tenancy, Caching und Audit-Logging ergänzt (28.02.2026)
- [x] 6.3.5 arc42 `09-architecture-decisions` um ADR-Verweise ergänzt (28.02.2026)
- [x] 6.3.6 arc42 `10-quality-requirements` um P95 < 50 ms und RLS-Isolation ergänzt (28.02.2026)
- [x] 6.3.7 arc42 `11-risks-and-technical-debt` um Scope-Bleeding ergänzt (28.02.2026)

### 6.4 Governance-Regeln verschärfen

- [x] 6.4.1 `design.md`-Pflicht pro Child-Change als Governance-Regel im Masterplan verankert (Child B–F besitzen design.md)

### 6.5 Security-Review-Befunde (26.02.2026)

- [x] 6.5.1 DSGVO-Betroffenenrechte: neuen Child-Change `add-iam-data-subject-rights` (Child F) anlegen
- [x] 6.5.2 PII-Pseudonymisierung: Strategie in Auditing-Specs verankern (Base-Spec + Delta-Specs)
- [x] 6.5.3 Encryption at Rest: als Anforderung in Child B verankern
- [x] 6.5.4 Datenklassifizierung: Schutzlevel-Konzept in Child B ergänzen
- [x] 6.5.5 RLS-Bypass-Szenarien: Negativtests in Child B Spec ergänzen
- [x] 6.5.6 Keycloak-Härtung (MFA, Lockout, Passwort, Timeout): als deferred dokumentieren – kein Blocker für Entwicklungsphase
- [x] 6.5.7 ~~GitHub Issue für SBOM-Generierung als CI-Task erstellen~~ → Bereits vorhanden: Issue #18 und #72
- [x] 6.5.8 Base-Specs Sprachhinweis: Übersetzungsbedarf in Tasks dokumentieren

### 6.6 Logging & Observability-Review-Befunde (26.02.2026)

- [x] 6.6.1 Masterplan-Leitplanke: SDK Logger Pflicht und ADR-006-Verbindlichkeit als Governance-Regel verankert
- [x] 6.6.2 `workspace_id` ↔ `instanceId` Mapping in decision-checklist als Must-Entscheidung verankert
- [x] 6.6.3 Governance-Spec: Observability-Requirements (SDK Logger, Korrelation, Dual-Write) als verbindliche Spec-Leitplanken ergänzt
- [x] 6.6.4 Log-Level-Konvention für IAM-Operationen definiert und in decision-checklist dokumentiert
- [x] 6.6.5 Korrelations-IDs (request_id, trace_id) als Pflicht in OIDC- und Authorize-Flows verankert
- [x] 6.6.6 Dual-Write (DB + OTEL) für Audit-Events in Governance-Spec und Child-A-Auditing-Spec ergänzt
- [x] 6.6.7 Child A Tasks: SDK Logger + Korrelation + Token-Error-Logging ergänzt
- [x] 6.6.8 Child C Tasks: Authorize-Entscheidungen loggen ergänzt
- [x] 6.6.9 Child D Tasks: Cache-Events (Hit/Miss/Stale/Invalidation) als SDK-Logger-Events ergänzt
- [x] 6.6.10 Child E Tasks: Impersonation-Events (Start/Ende/Timeout/Abbruch) granular ergänzt
- [x] 6.6.11 arc42 `logging-architecture` als betroffenen Abschnitt in Masterplan-Impact aufgenommen
