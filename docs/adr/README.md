# Architecture Decision Records (ADRs)

Zentrale Dokumentation aller technischen und architektonischen Entscheidungen im SVA Studio Projekt.

## Was sind ADRs?

Architecture Decision Records dokumentieren **wichtige technische Entscheidungen**, die langfristige Auswirkungen auf das Projekt haben. Sie speichern:

- **Kontext:** Warum musste eine Entscheidung getroffen werden?
- **Entscheidung:** Was wurde entschieden?
- **Begründung:** Warum diese Option?
- **Konsequenzen:** Welche positiven und negativen Folgen hat das?
- **Alternativen:** Welche anderen Optionen wurden erwogen?

### Warum ADRs wichtig sind

- 📚 **Wissenserhalt:** Neuen Team-Mitgliedern das "Warum" erklären
- 🧠 **Kontext-Bewahrung:** In 6 Monaten erinnert sich niemand, warum React gewählt wurde
- 🤝 **Transparenz:** Community sieht, wie Entscheidungen getroffen werden
- 🔄 **Rückverfolgung:** Wenn etwas schiefgeht, können wir nachsehen, was übersehen wurde
- 📋 **Governance:** Open-Source-Projekte profitieren von dokumentierten Entscheidungen

---

## Übersicht aller ADRs

### Status-Legende

| Symbol | Bedeutung                                          |
| ------ | -------------------------------------------------- |
| ✅     | Accepted – Aktuelle, gültige Entscheidung          |
| 📋     | Proposed – Unter Diskussion, Abstimmung ausstehend |
| 🔄     | Superseded – Durch neuere ADR ersetzt              |
| ❌     | Deprecated – Nicht mehr relevant                   |

---

### ADR-Liste (kanonischer Bestand unter `docs/adr/`)

| #   | Titel                                                                                                                                                                         | Status | Entscheidungsdatum | Thema                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------ | --------------------------------- |
| 000 | [ADR-Template](./ADR-000-template.md)                                                                                                                                         | 📋     | -                  | Dokumentation                     |
| 001 | [Frontend Framework Selection](./ADR-001-frontend-framework-selection.md)                                                                                                     | ✅     | 2026-01-18         | Frontend / Routing                |
| 002 | [Plugin Architecture Pattern](./ADR-002-plugin-architecture-pattern.md)                                                                                                       | ✅     | 2026-01-18         | Plugins / Architektur             |
| 003 | [Design Token Architecture](./ADR-003-design-token-architecture.md)                                                                                                           | ✅     | 2026-01-18         | UI / Design-System                |
| 004 | [Monitoring Stack – Loki, Grafana und Prometheus](./ADR-004-monitoring-stack-loki-grafana-prometheus.md)                                                                      | ✅     | 2026-02-05         | Monitoring / Betrieb              |
| 005 | [Observability Module Ownership](./ADR-005-observability-module-ownership.md)                                                                                                 | 📋     | 2026-02-06         | Observability / Ownership         |
| 006 | [Logging Pipeline Strategy](./ADR-006-logging-pipeline-strategy.md)                                                                                                           | ✅     | 2026-02-06         | Logging / Observability           |
| 007 | [Label Schema und PII Policy](./ADR-007-label-schema-and-pii-policy.md)                                                                                                       | ✅     | 2026-02-06         | Logging / Datenschutz             |
| 008 | [Codecov für Coverage-Reporting und PR-Transparenz](./ADR-008-codecov-coverage-reporting-and-gates.md)                                                                        | ✅     | 2026-02-18         | Testing / Governance              |
| 009 | [Keycloak als zentraler Identity Provider](./ADR-009-keycloak-als-zentraler-identity-provider.md)                                                                             | ✅     | 2026-02-27         | IAM / Auth                        |
| 010 | [Verschlüsselungsstrategie für IAM Core Data Layer](./ADR-010-verschluesselung-iam-core-data-layer.md)                                                                        | ✅     | 2026-02-27         | Security / Data                   |
| 011 | [`instanceId` als kanonischer Mandanten-Scope](./ADR-011-instanceid-kanonischer-mandanten-scope.md)                                                                           | ✅     | 2026-02-27         | IAM / Architektur                 |
| 012 | [Permission-Kompositionsmodell für RBAC v1](./ADR-012-permission-kompositionsmodell-rbac-v1.md)                                                                               | ✅     | 2026-02-27         | IAM / Authorization               |
| 013 | [RBAC+ABAC-Hybridmodell für IAM-Authorize](./ADR-013-rbac-abac-hybridmodell.md)                                                                                               | ✅     | 2026-02-28         | IAM / Authorization               |
| 014 | [Postgres NOTIFY für IAM-Cache-Invalidierung](./ADR-014-postgres-notify-cache-invalidierung.md)                                                                               | ✅     | 2026-02-28         | Data / Runtime                    |
| 015 | [CSRF-Schutz-Strategie für IAM-v1](./ADR-015-csrf-schutz-strategie.md)                                                                                                        | ✅     | 2026-03-08         | Security                          |
| 016 | [IdP-Abstraktionsschicht über `IdentityProviderPort`](./ADR-016-idp-abstraktionsschicht.md)                                                                                   | ✅     | 2026-03-08         | IAM / Integration                 |
| 017 | [Modulare IAM-Server-Bausteine](./ADR-017-modulare-iam-server-bausteine.md)                                                                                                   | ✅     | 2026-03-08         | IAM / Qualität                    |
| 018 | [Auth-Routing-Error-Contract und Header-basierte Korrelation](./ADR-018-auth-routing-error-contract-und-korrelation.md)                                                       | ✅     | 2026-03-09         | Auth / Observability              |
| 019 | [Swarm-/Traefik-Referenz-Betriebsprofil](./ADR-019-swarm-traefik-referenz-betriebsprofil.md)                                                                                  | ✅     | 2026-03-12         | Deployment / Betrieb              |
| 020 | [Kanonischer Auth-Host und Multi-Host-Grenze](./ADR-020-kanonischer-auth-host-multi-host-grenze.md)                                                                           | ✅     | 2026-03-12         | Auth / Deployment                 |
| 021 | [Per-User-SVA-Mainserver-Delegation](./ADR-021-per-user-sva-mainserver-delegation.md)                                                                                         | ✅     | 2026-03-14         | Integration / IAM                 |
| 022 | [IAM Groups, Geo-Hierarchie und erweitertes Permission-Caching (Pakete 3–5)](./ADR-022-iam-groups-geo-hierarchie-permission-caching.md)                                       | ✅     | 2026-03-17         | IAM / Authorization / Runtime     |
| 023 | [Führender Session-Lifecycle, Forced Reauth und kontrolliertes Silent SSO](./ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md)                                       | ✅     | 2026-03-26         | Auth / Session                    |
| 024 | [IAM-Gruppen als eigenständige, instanzgebundene Entität](./ADR-024-iam-groups-als-eigenstaendige-entitaet.md)                                                                | ✅     | 2026-03-31         | IAM / Authorization               |
| 025 | [Prioritätsregel für Multi-Scope-IAM-Entscheidungen](./ADR-025-multi-scope-prioritaetsregel-fuer-iam.md)                                                                      | ✅     | 2026-03-31         | IAM / Authorization               |
| 026 | [Redis als primärer Shared Permission Cache](./ADR-026-redis-als-primary-permission-cache.md)                                                                                 | ✅     | 2026-03-31         | Runtime / IAM                     |
| 027 | [Rechtstext-Fail-Closed und blockierter Session-Zustand](./ADR-027-rechtstext-fail-closed-und-blockierte-session.md)                                                          | ✅     | 2026-03-31         | Auth / Legal / IAM                |
| 028 | [IAM-Konfigurations-Export als dokumentierte Folgearbeit](./ADR-028-iam-konfigurations-export-als-folgearbeit.md)                                                             | ✅     | 2026-03-31         | IAM / Technical Debt              |
| 029 | [`goose` als OSS-Standard für SQL-Migrationen](./ADR-029-goose-als-oss-standard-fuer-sql-migrationen.md)                                                                      | ✅     | 2026-04-01         | Data / Betrieb / Tooling          |
| 030 | [Registry-basierte Instance-Freigabe und Provisioning](./ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)                                                     | ✅     | 2026-04-02         | IAM / Plattform                   |
| 031 | [Tenant-spezifisches Realm-Auth-Routing](./ADR-031-tenant-spezifisches-realm-auth-routing.md)                                                                                 | ✅     | 2026-04-02         | IAM / Auth                        |
| 032 | [Plattform-Scope vs. Tenant-Instanz](./ADR-032-plattform-scope-vs-tenant-instanz.md)                                                                                          | ✅     | -                  | IAM / Plattform                   |
| 033 | [Tenant-Login-Client vs. Tenant-Admin-Client](./ADR-033-tenant-login-client-vs-tenant-admin-client.md)                                                                        | ✅     | -                  | IAM / Auth                        |
| 034 | [Plugin-SDK-Vertrag v1](./ADR-034-plugin-sdk-vertrag-v1.md)                                                                                                                   | ✅     | 2026-04-13         | Studio / Plugins / SDK            |
| 035 | [Routing-Observability über Diagnostics-Hook und Safe-Event-Vertrag](./ADR-035-routing-observability-diagnostics-hook.md)                                                     | ✅     | 2026-04-19         | Routing / Observability           |
| 036 | [Kanonischer IAM-Projektions- und Reconcile-Vertrag](./ADR-036-kanonischer-iam-projektions-und-reconcile-vertrag.md)                                                          | ✅     | 2026-04-19         | IAM / Runtime / UI                |
| 037 | [Plugin-spezifische IAM-Rechte](./ADR-037-plugin-spezifische-iam-rechte.md)                                                                                                   | ✅     | 2026-04-27         | Plugins / IAM / Authorization     |
| 038 | [Instanz-Modul-Zuordnung und fail-closed Modulaktivierung](./ADR-038-instanz-modul-zuordnung-und-fail-closed-modulaktivierung.md)                                             | ✅     | 2026-04-29         | Runtime / Plugins / IAM           |
| 039 | [Medienmanagement als Host-Capability mit Storage- und Processing-Vertrag](./ADR-039-medienmanagement-host-capability-und-storage-vertrag.md)                                 | ✅     | 2026-04-29         | Media / Storage / Runtime         |
| 040 | [graphile-worker als Standard für Hintergrundprozesse](./ADR-040-graphile-worker-als-standard-fuer-hintergrundprozesse.md)                                                    | ✅     | 2026-05-09         | Runtime / Workflow / Betrieb      |
| 041 | [Plugin-Plattform v2 für externe Distribution und host-owned Runtime](./ADR-041-plugin-plattform-v2-fuer-externe-distribution.md)                                             | ✅     | 2026-05-10         | Plugins / Distribution / Runtime  |
| 042 | [Externe Schnittstellen als host-owned Registry](./ADR-042-externe-schnittstellen-als-host-owned-registry.md)                                                                 | ✅     | 2026-05-12         | Integration / Secrets / Runtime   |
| 043 | [Formular-Foundation mit react-hook-form und zodResolver](./ADR-043-formular-foundation-mit-react-hook-form-und-zodresolver.md)                                               | ✅     | 2026-05-22         | Frontend / Formulare / Governance |
| 044 | [Frontend-Test-Foundation mit MSW und selektivem fast-check](./ADR-044-frontend-test-foundation-mit-msw-und-selektivem-fast-check.md)                                         | ✅     | 2026-05-22         | Frontend / Testing / Governance   |
| 045 | [Organisationsgebundene Mainserver-Credentials und policy-gesteuerte Delegation](./ADR-045-organisationsgebundene-mainserver-credentials-und-policy-gesteuerte-delegation.md) | ✅     | 2026-06-01         | Integration / IAM / Security      |
| 046 | [Plattform- vs. Tenant-Rollenmodell und Legacy-Standardrollen](./ADR-046-plattform-vs-tenant-rollenmodell-und-legacy-standardrollen.md)                                       | ✅     | 2026-07-12         | IAM / Authorization               |
| 047 | [Keycloak-Service-Accounts für die lokale MCP-Control-Plane](./ADR-047-keycloak-service-accounts-fuer-lokale-mcp-control-plane.md)                                            | ✅     | 2026-07-13         | MCP / IAM / Security / Betrieb    |
| 048 | [Zentraler Backup-Agent mit gehärtetem HTTPS-Trigger](./ADR-048-zentraler-backup-agent-mit-gehaertetem-https-trigger.md)                                                      | ✅     | 2026-07-19         | Backup / Security / Betrieb       |
| 049 | [Kanonischer Permission-Katalog und additiver Reconcile](./ADR-049-kanonischer-permission-katalog-und-additiver-reconcile.md)                                                 | ✅     | 2026-08-02         | IAM / Authorization / Betrieb     |
| 050 | [Zentraler scopegebundener UI-Zugriff](./ADR-050-zentraler-scopegebundener-ui-zugriff.md)                                                                                     | ✅     | 2026-08-08         | UI / IAM / Authorization          |
| 051 | [Technische Accounts und Organisations-Mainserver-Provisioning](./ADR-051-technische-accounts-und-organisations-mainserver-provisioning.md)                                   | ✅     | 2026-08-11         | IAM / Integration / Recovery      |
| 052 | [Create-Policy, Read-Scope und Bestandsprincipal trennen](./ADR-052-create-policy-read-scope-und-bestandsprincipal.md)                                                        | ✅     | 2026-08-13         | IAM / Content                     |
| 053 | [Layout-Shell mit Skeleton-Bereichen](./ADR-053-layout-shell-skeleton-architecture.md)                                                                                        | ✅     | 2026-02-25         | Frontend / Layout                 |
| 054 | [Kontrollierter Inhabertransfer für Inhalte](./ADR-054-kontrollierter-inhabertransfer-fuer-inhalte.md)                                                                        | ✅     | 2026-08-27         | IAM / Content / Mainserver        |
| 055 | [Waste-Mainserver-Abgleichsstatus über Quellrevision](./ADR-055-waste-mainserver-abgleichsstatus-ueber-quellrevision.md)                                                      | ✅     | 2026-08-27         | Waste / Integration / Runtime     |
| 057 | [SSF-Service-Token und Runtime-Konfigurationsgrenze](./ADR-057-ssf-service-token-und-runtime-konfigurationsgrenze.md)                                                        | ✅     | 2026-09-01         | SSF / IAM / Plugins / Runtime     |

### Kanonischer Ablageort

- Aktive ADRs liegen unter `docs/adr/`.
- Verweise aus Architektur- und Guide-Dokumenten sollen auf `docs/adr/` zeigen.
- Die weiterhin gültigen einzigartigen Legacy-Entscheidungen ADR-001 bis ADR-008 sowie die Layout-Shell-Entscheidung wurden in diesen kanonischen Bestand übernommen. Wegen der bereits belegten Nummer 009 trägt die Layout-Shell hier die neue Nummer 053.
- `ADR-018-auth-routing-error-contract-und-korrelation.md` wurde bereits aus dem Legacy-Ordner nach `docs/adr/` migriert und ist dort maßgeblich.
- Dateien unter `docs/architecture/decisions/` sind historischer Altbestand einer älteren ADR-Serie mit überschneidenden Nummern und kein Ziel für neue ADRs.

---

## ADR-Lebenszyklus

```
Issue                PR              Merged              Review
(Discussion)        (ADR-File)      to main             (6 Monate später)
   │                   │               │                    │
   v                   v               v                    v
[Propose]──────→[Review & Draft]──→[Accept]────────→[Evaluate & Update]
   7 Tage         3-5 Reviews       1 Merge             oder Supersede
```

### Phasen erklärt

#### 1. **Proposed Phase** (Issue)

- **Dauer:** ~7 Tage
- **Wo:** GitHub Issue (Label: `adr`, `decision-required`)
- **Ziel:** Team & Community einbinden
- **Beispiel-Frage:** "Sollen wir React oder Vue verwenden?"

#### 2. **Review Phase** (PR)

- **Dauer:** 3-5 Tage
- **Wo:** GitHub PR mit ADR-Datei (Label: `adr`)
- **Review:** Min. 2 Approvals von Senior-Entwicklern
- **Format:** Nutze ADR-000-template.md

#### 3. **Accepted Phase**

- **Dauer:** Unbegrenzt (bis superseded)
- **Wo:** docs/adr/ADR-XXX.md im main-Branch
- **Status:** Aktive Entscheidung, die Entwicklung leitet

#### 4. **Evaluation Phase** (Optional)

- **Dauer:** Nach 6-12 Monaten (regelmäßige Reviews)
- **Frage:** "War diese Entscheidung richtig? Sollten wir sie ändern?"
- **Outcome:** Accept (weiterhin gültig) oder Supersede (neue ADR erstellen)

---

## Wie erstelle ich eine ADR?

### Schritt 1: Issue erstellen (Discussion)

```bash
gh issue create \
  --title "[ADR] Entscheidung: Welches Frontend-Framework?" \
  --label "adr,decision-required,discussion" \
  --body "## Kontext
Wir müssen ein Frontend-Framework wählen.

## Optionen
- React 18
- Vue 3
- Svelte

## Diskussionspunkte
1. Team-Erfahrung?
2. Performance-Anforderungen?
3. A11y-Support?

## Timeline
Abstimmung bis [Datum]"
```

**Dauer:** ~7 Tage Discussion

---

### Schritt 2: ADR schreiben (Draft)

Erstelle Datei `docs/adr/ADR-001-frontend-framework.md`:

```bash
cp docs/adr/ADR-000-template.md docs/adr/ADR-001-frontend-framework.md
```

Editiere die Datei und fülle folgende Sektionen aus:

- ✅ Kontext
- ✅ Entscheidung
- ✅ Begründung
- ✅ Alternativen
- ✅ Konsequenzen + Mitigationen
- ✅ Implementierungs-Roadmap

---

### Schritt 3: PR erstellen (Review)

```bash
git add docs/adr/ADR-001-frontend-framework.md
git commit -m "docs(adr): ADR-001 – Frontend Framework Entscheidung"
git push origin feature/adr-001-frontend-framework
gh pr create \
  --title "docs(adr): ADR-001 – Frontend Framework auswählen" \
  --body "Dokumentiert die Entscheidung für React 18 basierend auf Issue #XYZ Diskussion." \
  --label "adr,documentation" \
  --draft
```

**PR-Checkliste:**

- [ ] Issue-Nummer verlinkt
- [ ] Diskussions-Ergebnisse dokumentiert
- [ ] Alternativen fair dargestellt
- [ ] Konsequenzen realistisch
- [ ] Min. 2 Reviews erforderlich

---

### Schritt 4: Merge & Accept

Nach Approvals:

```bash
gh pr merge <PR-Number> --squash
```

**Update ADR-Status:** `Proposed` → `Accepted`

---

## Best Practices

### ✅ DO

- ✅ **ADR für große Entscheidungen:** Tech-Stack, Architektur, Patterns
- ✅ **Neutral schreiben:** Alle Optionen fair bewerten
- ✅ **Konkret sein:** Keine vagen Aussagen ("wahrscheinlich besser")
- ✅ **Konsequenzen dokumentieren:** Positive UND Negative
- ✅ **Regelmäßig reviewen:** Nach 6-12 Monaten überprüfen
- ✅ **Updaten bei Änderungen:** Wenn sich etwas fundamental ändert

### ❌ DON'T

- ❌ **ADR statt schneller Bugs:** Nicht für jeden kleinen Fix
- ❌ **Zu kurz:** Mindestens 300 Wörter, erklärbar ohne Vorwissen
- ❌ **Voreingenommenheit:** Eine Option von Anfang an kritisieren
- ❌ **"Entschieden von oben":** ADRs sind Team-Entscheidungen
- ❌ **Vergessen:** ADRs müssen gelebt und evaluiert werden

---

## Konvention

### Datei-Naming

```
ADR-<Nummer>-<short-description>.md

Beispiele:
- ADR-001-frontend-framework.md
- ADR-002-state-management.md
- ADR-003-testing-framework.md
```

### Nummerierung

- Laufende Nummern: ADR-001, ADR-002, ...
- Nicht wiederverwendbare Nummern (Lücken sind OK)
- Neue ADR = nächste höchste Nummer

### Titel-Format im GitHub Issue

```
[ADR] <Entscheidungsgegenstand>
```

Beispiele:

- `[ADR] Frontend Framework – React vs. Vue vs. Svelte`
- `[ADR] State Management Library auswählen`

---

## Integration mit Projektmanagement

### Issue-Labels

| Label               | Bedeutung                    |
| ------------------- | ---------------------------- |
| `adr`               | Architecture Decision Record |
| `decision-required` | Entscheidung ausstehend      |
| `discussion`        | Offene Diskussion            |
| `blocked`           | Andere ADR blockiert diese   |

### Linking

**In Issue-Body:**

```markdown
Abhängig von: #XYZ (ADR für Basis-Framework)
Blockt: #ABC (ADR für State Management)
```

---

## Beispiel-ADR (komplett)

Ein möglicher Dateiname wäre `ADR-001-frontend-framework.md`; als Ausgangspunkt dient das [ADR-Template](./ADR-000-template.md).

---

## Häufig gestellte Fragen (FAQ)

### F: Wann sollte ich eine ADR erstellen?

**A:** Wenn die Entscheidung:

- Die Architektur prägt (> 6 Monate Gültigkeit)
- Mehrere Team-Mitglieder betrifft
- Schwer rückgängig zu machen ist
- Langfristige Kosten/Nutzen hat

**Nicht für:**

- Kleine Bug-Fixes
- Unbedeutende Library-Wahl
- Tägliche Entwicklungs-Entscheidungen

### F: Kann ich eine ADR ändern?

**A:** Ja, aber:

1. Wenn nur Klarstellung: Update direkt
2. Wenn fundamentale Änderung: Neue ADR erstellen, alte als "Superseded" markieren

Beispiel: Wenn React-Decision später zu Vue wechselt:

```markdown
**Status:** Superseded by ADR-006
```

### F: Wie lange sollte ich diskutieren?

**A:** Standard: ~7 Tage

- Einfache Entscheidung: 3-5 Tage
- Komplexe Entscheidung: 2 Wochen
- Kritische Entscheidung: 3 Wochen

### F: Wer kann eine ADR schreiben?

**A:** Jeder im Team! Aber:

- Idealerweise jemand mit Kontext
- Review von mindestens 1 Senior-Dev
- Genehmigung durch BDFL oder Tech Lead

### F: Sind ADRs bindend?

**A:** **Ja, solange sie "Accepted" sind.** Sie können nicht einfach ignoriert werden. Wenn jemand ein Problem mit einer ADR hat:

1. Diskutiert im Team
2. Neue ADR schreiben, die alte superseded
3. Implementierung anpassen

---

## Tools & Automation

### ADR-Generierung

Verwende das Template `ADR-000-template.md` als Basis für neue ADRs:

```bash
cp docs/adr/ADR-000-template.md docs/adr/ADR-XXX-your-decision.md
```

### Validierung (geplant)

- GitHub Action zur Syntax-Validierung
- Checklist für Merge
- Lint-Rule für Template-Erfüllung

---

## Kontakt & Fragen

Hast du Fragen zu ADRs?

- **Discord:** #architecture-decisions
- **GitHub:** Öffne Issue mit Label `adr`
- **Docs:** Siehe [Architekturübersicht](../architecture/README.md)

---

## Verwandte Ressourcen

- [ADR GitHub Repository](https://adr.github.io/)
- [MADR – Markdown ADR](https://adr.github.io/madr/)
- [Architecture Decision Record (ADR) – Examples](https://github.com/joelparkerhenderson/architecture_decision_record)
- [Documenting Architecture Decisions – Michael Nygard](http://thinkrelevant.com/blog/2011/11/15/documenting-architecture-decisions/)

---

**Letzte Aktualisierung:** 2026-01-08
**Nächste Überprüfung:** 2026-07-08 (6 Monate)
