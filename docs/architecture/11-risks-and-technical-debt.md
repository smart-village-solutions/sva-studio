# 11 Risiken und technische Schulden

## Zweck

Dieser Abschnitt dokumentiert bekannte Architektur-Risiken und technische
Schulden auf IST-Basis.

## Mindestinhalte

- Priorisierte Risiko-/Schuldenliste
- Auswirkungen, Eintrittswahrscheinlichkeit, Gegenmaßnahmen
- Verantwortliche und Zieltermine

## Aktueller Stand

### Priorisierte Risiken

1. Drift zwischen Intermediate-SSR-Output und finaler Runtime
   - Impact: hoch (ein scheinbar gruener Build kann im finalen `.output/server/**` dennoch einen anderen Server-Entry oder Dispatch-Pfad ausliefern)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: finalen Runtime-Vertrag ueber `verify:runtime-artifact` und runner-basiertes Image-Verify erzwingen; `.nitro/vite/services/ssr/**` nur noch als Diagnosematerial behandeln

1. Geheimnisse in lokalen Env-Dateien
   - Impact: hoch (Credential Leak Risiko)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Secrets rotieren, lokale Env-Dateien strikt aus VCS halten, Secret-Scan in CI

2. Uneinheitliche Testabdeckung
   - Impact: mittel bis hoch (Regressionen spät erkannt)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Exempt-Projekte schrittweise abbauen, Coverage-Floors erhöhen

3. Routing-Komplexität durch dualen Ansatz (file-based + code-based)
   - Impact: mittel (Fehlkonfiguration/Bundling-Fehler)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: klare Source-of-Truth Regeln und mehr Routing-Tests; die produktive Auth-Registry ist inzwischen auf `packages/routing` konsolidiert, Rest-Risiko bleibt für generelle Route-Komposition

4. Observability-Abhängigkeit von korrekter Initialisierung
   - Impact: mittel (blinde Flecken im Betrieb)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: robuste Startup-Checks und automatische Verifikation der OTEL-Pipeline

5. Dokumentationsdrift bei schnell wandelnden Architekturteilen
   - Impact: mittel
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Doku-Agent Reviews bei Proposal/PR verpflichtend nutzen

6. Globaler Pending-basierter Initial-Loading-Zustand in der Root-Shell
   - Impact: mittel (inkonsistente Wahrnehmung bei langsamen/ schnellen Backends)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Loading-Orchestrierung an echte Pending-/Datenzustände koppeln

7. Statisch verdrahtete Shell-Navigation
   - Impact: mittel (höhere Kopplung, schlechtere Erweiterbarkeit)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Navigationsziele schrittweise über deklarative Route-/Plugin-Metadaten speisen

8. i18n-Schulden in UI-Texten
   - Impact: mittel (A11y-/Lokalisierungsqualität)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: UI-Texte konsistent über Übersetzungsschlüssel (`t('key')`) verwalten

9. Governance-Workflow-Komplexität (Approval, Delegation, Impersonation)
   - Impact: hoch (Fehlfreigaben oder Restberechtigungen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: harte Gates, Negativtests, Ablauf-/Widerrufstests, verpflichtendes Runbook

10. Keycloak-Integrationsdrift bei Claims/Sessionvalidierung
   - Impact: hoch (inkonsistente Identitäts-/Autorisierungskette)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: stabile Claim-Mappings (`sub`, Rollen/Groups), Korrelation in Audit-Events, Integrationstests

11. Scope-Bleeding zwischen IAM-Child-Changes
   - Impact: hoch (unklare Verantwortlichkeit, Architekturdrift, regressionsanfällige Implementierung)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Child-spezifische Delta-Specs strikt einhalten, Scope im PR gegen Masterplan prüfen, Review-Gates vor Implementierungsstart erzwingen

12. Frontend-Task-Drift zwischen Paket-Skripten und Nx-Targets
   - Impact: mittel (uneinheitliche lokale Läufe, unvollständige Cache-Invalidierung, CI-Abweichungen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `sva-studio-react`-Standard-Tasks ausschließlich über dokumentierte Nx-Targets betreiben und Änderungen an Vite/Vitest/Playwright-Konfiguration immer gegen `inputs`/`outputs` prüfen

13. Hohe strukturelle Komplexität in zentralen IAM- und Routing-Modulen
   - Impact: hoch (Refactorings werden riskant, Sicherheits- und Routing-Fehler bleiben schwer lokalisierbar)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: `complexity-gate`, ticketpflichtige tracked findings, Hotspot-Coverage für kritische Dateien

14. Registry-Cache aktuell nur als L1 im App-Prozess
   - Impact: mittel (mehr DB-Last oder inkonsistente Sicht bei mehreren Prozessen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Redis-L2-Cache oder NOTIFY-basierte Cross-Process-Invalidierung als Folgearbeit bewerten

15. Re-Authentisierung für Instanzmutationen aktuell nur als schlanker technischer Nachweis modelliert
   - Impact: mittel bis hoch (Sicherheitsniveau hängt an nachgelagerten Integrationsschritten)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Session-seitig frische Reauth-Zeitmarke und serverseitige Prüfung als nächste Härtung einführen

14. Übergangsphase mit modularen Fassaden und verbleibenden `core.ts`-Hotspots
   - Impact: mittel bis hoch (Reviewer müssen zwischen stabiler API und Restschuld-Kern unterscheiden)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Restschuld nur mit `QUAL-*`-Ticket, klare Doku der Modulgrenzen und inkrementelle Weiterzerlegung

15. Gemischte Token- und Direktfarben im Frontend
   - Impact: mittel (visuelle Inkonsistenz, erschwerte Theme-Pflege)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Shell zuerst vollständig auf semantische Tokens umstellen und Route-Flächen schrittweise nachziehen

16. Theme-Drift zwischen `instanceId`-Auflösung und realem Branding-Bedarf
   - Impact: mittel bis hoch (falsches Branding pro Instanz)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Theme-Mapping zentral halten, Unknown-Fallback definieren und Varianten nur kontrolliert erweitern

17. Prozesslokale Cache-Skalierung in der Mainserver-Integration
   - Impact: mittel bis hoch (uneinheitliche Warm-Path-Latenz, erhöhter Speicherverbrauch bei vielen Nutzern)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: LRU-begrenzte In-Memory-Caches, Debug-Logs für Hit/Miss, Benchmark vor Produktivbetrieb und ggf. Redis-basierter Shared Cache als Folgearbeit

18. Schema-Drift zwischen Staging/Mainserver und checked-in Snapshot
   - Impact: hoch (unerwartete GraphQL-Fehler trotz erfolgreichem Build)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Snapshot aktuell halten, `graphql-inspector`-Vergleich gegen Staging vorbereiten und Diagnostik-Adapter nur inkrementell erweitern

19. Drift zwischen Gruppenbündeln, Rollenmatrix und effektiver Berechtigungswahrnehmung
   - Impact: hoch (Admins sehen oder vergeben Rechte, die durch Gruppenmitgliedschaften missverstanden werden)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: strukturierte Provenance (`sourceRoleIds`, `sourceGroupIds`, `sourceKinds`) durchgängig in API, UI und Tests halten

20. Geo-Read-Modell ohne externe Live-Quelle
   - Impact: mittel bis hoch (veraltete Geo-Hierarchien können falsche Vererbungsentscheidungen begünstigen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `iam.geo_units` als explizites Read-Modell dokumentieren, Seeds/Testdaten versionieren und spätere Synchronisationsstrategie getrennt entscheiden

21. Unvollständige Betriebsautomatisierung trotz gehärtetem Acceptance-Releasepfad
   - Impact: hoch (manuelle Restschritte außerhalb des Repos können die technische Freigabe überholen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Digest-Promotion, Alertmanager-Receiver, Backup-Automation und HA-Schritte als explizite Folgearbeit getrennt nachziehen

22. Lokaler Quantum-Hidden-State in Remote-Diagnosepfaden
   - Impact: mittel bis hoch (falsch-negative Diagnosen trotz gesundem Stack)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Read-only Pfade auf Portainer-API mit fester Endpoint-ID begrenzen, `quantum-cli exec` nur als Fallback zulassen und produktionsnahe Mutationen auf den expliziten lokalen Operator-Pfad fokussieren

23. Begrenzte lokale Nachbildbarkeit des `studio`-Ingress- und Private-DNS-Vertrags
   - Impact: hoch (lokale Kandidatencontainer koennen Root-/Tenant-/OIDC-Paritaet falsch negativ oder unvollstaendig abbilden)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: prod-nahe Freigaben an Remote-Paritaet binden, identische Live-Digests nur ueber dokumentierte Live-Evidenz wiederverwenden und lokale Kandidaten explizit als Hilfssignal behandeln

24. Generische IAM-Rechte ohne Content-Type-Qualifier
   - Impact: mittel bis hoch (Plugins mit unterschiedlichen Content-Typen teilen sich denselben Rechtekanon und koennen nur begrenzt separat freigeschaltet werden)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `content.read|create|write` in v1 beibehalten, feingranulare Content-Type-Rechte als Folgearbeit getrennt bewerten

25. Untypisiertes `payload_json` als persistente Core-Struktur
   - Impact: mittel (Schema-Drift oder unvollständige Validierung kann erst im Write-Pfad auffallen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: serverseitige contentType-Registry und Zod-Validierung beibehalten, stärkere Persistenztypisierung nur kontrolliert und migrationsgestützt einführen

26. Statische Bundle-Plugins statt Runtime-Loading
   - Impact: mittel (geringere betriebliche Flexibilität, Host-Rebuild für neue Plugins erforderlich)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: statische Registrierung als bewussten v1-Trade-off dokumentieren und später nur mit Versionierungs-, Signierungs- und Sicherheitskonzept erweitern

27. Fragmentierter öffentlicher IAM-Diagnosevertrag
   - Impact: hoch (gleiche Symptome werden in UI, Betrieb und Folgeanalyse unterschiedlich gelesen; Refactorings setzen auf unvollständiger Fehlertrennung auf)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: classification-basierten Diagnosekern für Auth, IAM und Provisioning durchziehen; Tenant-Host-, Registry- und Session-Hydration-Faelle liefern jetzt strukturierte Fehlerantworten bis ins Frontend, Restscope bleibt fuer weitere IAM-Hotspots und Folgechange unter `openspec/changes/refactor-iam-runtime-diagnostics-contract/`

28. Recovery-Pfade kaschieren degradierte IAM-Zustände
   - Impact: hoch (Silent-Recovery, Session-Hydration oder Fallbacks können echte Drift und Teilfehler überdecken)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: degradierte und recovery-nahe Zustände explizit modellieren und UI-/Ops-seitig sichtbar machen, statt nur Endzustände zu berichten; tenantgebundene Sessions ohne `instanceId` sind jetzt fail-closed und werden nicht mehr still aus dem Host rekonstruiert, verbleibende Recovery-Pfade bleiben Folgearbeit

29. Offener Live-Triage-Befund für IAM-Diagnostik
   - Impact: mittel bis hoch (Repo-Analyse deckt reale Host-, Cookie-, Keycloak- und Datenzustandsprobleme nur teilweise ab)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: vorbereitete Szenario-Matrix aus `docs/reports/iam-diagnostics-analysis-2026-04-19.md` gegen reale Dev-/Staging-Umgebung ausführen, bevor der Analysechange als abgeschlossen gilt

### Technische Schulden (Auswahl)

- Teilweise No-Op Testtargets in Libraries
- Historisch gewachsene Doku mit gemischter Tiefe
- Offene Produktionsentscheidungen für Deployment/HA
- Root-Shell nutzt derzeit einen globalen Router-Pending-Trigger statt datenquellenspezifischer Pending-Orchestrierung
- Shell-Navigation ist aktuell nicht vollständig plugin-/metadatenbasiert
- Reifegrad von Governance-E2E-Tests muss im Produktiv-Rollout weiter erhöht werden
- Risiko von Scope-Bleeding bei schnellen IAM-Iterationen ohne harte Gate-Disziplin
- Mehrere historische IAM-Hotspots sind bewusst als tracked findings mit Refactoring-Backlog dokumentiert
- Nach der Fassaden-Zerlegung verbleibt Restkomplexität gezielt in `iam-account-management/users-handlers.ts`, `iam-account-management/roles-handlers.ts`, `iam-account-management/reconcile-handler.ts`, `iam-account-management/shared.ts`, `iam-data-subject-rights/core.ts`, `iam-governance/core.ts` und `keycloak-admin-client/core.ts`
- Route-Komponenten außerhalb der Shell verwenden noch teilweise direkte `slate-*`-/`emerald-*`-Farben und sind nicht vollständig tokenisiert
- Gruppen sind im ersten Schnitt reine Rollenbündel; direkte Gruppen-Permissions und ein separates Gruppen-Gültigkeitsmanagement pro UI-Flow bleiben Folgearbeit
- Die Geo-Hierarchie ist intern bereits auswertbar, besitzt aber noch keine dedizierte Admin-Oberfläche oder externe Pflegepipeline
- Der Releasevertrag ist im Repo gehärtet, aber produktive Randthemen wie Registry-Promotion, Receiver-Konfiguration und Multi-Node-Betrieb bleiben außerhalb dieses Changes
- Die Live-Paritaets-Wiederverwendung fuer identische Digests reduziert Drift-Risiko, ersetzt aber keinen spaeteren echten Off-Cluster-Paritaets-Pfad fuer neue Digests
- Plugin-Registrierung ist jetzt metadatenbasiert, aber noch nicht runtime-dynamisch
- Content-Payloads bleiben in Postgres generisch als JSON abgelegt; Typsicherheit wird aktuell im Serververtrag und nicht in der Datenbank erzwungen

### Nachverfolgung

- Risiken in OpenSpec-Changes und PR-Checklisten referenzieren
- Architekturrelevante Risiken in diesem Abschnitt laufend aktualisieren

Referenzen:

- `docs/reports/PR_CHECKLIST.md`
- `openspec/AGENTS.md`
- `docs/development/testing-coverage.md`
- `docs/development/complexity-quality-governance.md`
- `docs/guides/iam-governance-runbook.md`
- `docs/guides/iam-governance-freigabematrix.md`

### Ergänzung 2026-03: IAM-UI und Keycloak-Sync

14. Keycloak-API-Latenz oder Ausfall bei Admin-Operationen
   - Impact: hoch (Admin-Operationen blockieren)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Circuit-Breaker, Retry/Backoff, DB-Fallback für Reads, klare 503-Signale für Writes

15. Vendor-Lock-in auf Keycloak-Admin-API
   - Impact: mittel bis hoch
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `IdentityProviderPort` als stabile Abstraktionsschicht, Adapterwechsel ohne UI-Bruch

16. Wachstum von `iam.activity_logs`
   - Impact: mittel (Storage/Kosten/Query-Latenz)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Retention-Automation (Anonymisierung + Archivierung) mit mandantenspezifischen Policies

16a. Drift zwischen Plattform-Scope und Tenant-Scope
   - Impact: hoch (falsche Audit-Zuordnung, Root-Host-Fehler, unklare Logs)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: explizites `platform`-/`instance`-Scope-Modell, separate Audit-Stores und strukturierte `reason_code`-Fehlerpfade

17. Fehlkonfigurierte Keycloak-Service-Account-Rechte für Rollen-Sync
   - Impact: hoch (Role-CRUD und Reconcile schlagen reproduzierbar fehl)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: dokumentierte Least-Privilege-Matrix, Readiness-Checks und Alerts auf `IDP_FORBIDDEN`

18. Drift-Backlog durch orphaned, studio-markierte Keycloak-Rollen
   - Impact: mittel bis hoch (anhaltende Inkonsistenz, manueller Betriebsaufwand)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: geplanter Reconcile-Lauf, Alerting auf `iam_role_drift_backlog`, explizites Runbook für manuelle Freigaben

19. Fehlzuordnung privilegierter Rollen-Aliasse aus externen Claims
   - Impact: hoch (potenzielle Rechteausweitung über falsche Claim-Quelle)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: privilegierte Alias-Regeln nur aus `realm_access` ableiten, client-spezifische `resource_access`-Rollen strikt isolieren und per Tests absichern

20. Drift zwischen aktivem Organisationskontext und Membership-Realität
   - Impact: hoch (falscher Fachkontext in UI oder Folgepfaden)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: kanonischer Session-Contract, fail-closed Validierung, stabile Fehlercodes und Audit bei Kontextwechseln

21. Wachsende Komplexität in Organisationshierarchie und Deaktivierungsregeln
   - Impact: mittel bis hoch (Konfliktfälle, fehlerhafte Parent-Beziehungen, spätere Vererbungsregressionen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Negativtests für Zyklen/Konflikte, konservative Deaktivierung statt Delete und Folge-Change für Hierarchie-Vererbung getrennt halten

22. Drift zwischen strukturierten Permission-Feldern und Legacy-`permission_key`
   - Impact: mittel bis hoch (uneinheitliche Entscheidungsbasis, schwer reproduzierbare Berechtigungsfehler)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Kompatibilitätspfad explizit testen, Seeds idempotent halten und Alt-Daten schrittweise auf strukturierte Felder migrieren

23. Unvollständige Invalidation bei Hierarchie- oder Permission-Mutationen
   - Impact: hoch (temporär veraltete Authorize-Entscheidungen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Invalidation-Trigger auf Hierarchie-/Permission-Änderungen erweitern, Cache-Hit/Miss-Metriken überwachen und Performance-/Stale-Nachweis nachziehen

24. Verbleibende Doppelrolle der Env-basierten `instanceId`-Allowlist
   - Impact: mittel (lokale/operative Scopes können ohne klare Abgrenzung von der produktiven Registry-Realität abweichen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Registry bleibt führend; Env-Allowlist nur als lokaler oder migrationsbezogener Fallback dokumentieren und verbleibende SDK-/Bootstrap-Pfade schrittweise weiter reduzieren

25. Drift zwischen Transparenz-Read-Models und zugrunde liegenden IAM-Quellen
   - Impact: hoch (Admin- und Compliance-Sichten zeigen unvollständige oder missverständlich normalisierte Daten)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Contract-Tests für Governance-/DSR-Mapper, synchrone Pflege von OpenSpec, API-Guide und OpenAPI sowie gezielte Review-Gates bei Feldänderungen

26. Rollenmatrix-Drift zwischen Route-Guard, Tab-Gating und Backend-Reads
   - Impact: hoch (Overexposure oder unnötige Deny-Zustände in sensiblen Transparenz-Views)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Access-Matrix in `packages/routing`, Frontend-Helpern und Server-Handlern gemeinsam testen; Änderungen nur mit Doku- und Testanpassung mergen

27. Invalidation-Lücken bei Gruppenmitgliedschafts- oder Gruppenrollenänderungen
   - Impact: hoch (temporär veraltete Snapshots trotz korrekter Persistenz)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `user_group_changed` und gruppenbezogene Invalidierungen über Tests, Metriken und Review-Gates absichern

28. Fehlende Geo-Admin-Oberfläche im ersten Schnitt
   - Impact: mittel (Betrieb braucht weiterhin Seeds oder direkte Datenpflege)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: klarer Scope-Schnitt in Doku und OpenSpec, spätere Pflegepfade als separaten Change planen

29. Übernutzung direkter Nutzerrechte statt Rollen-/Gruppenmodell
   - Impact: mittel bis hoch (schwer nachvollziehbare Sonderfälle, Governance-Drift)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: UI-Hinweise auf Ausnahmecharakter, getrennte Darstellung von direkten und wirksamen Rechten und Review-Gate für privilegierte Einzelzuweisungen

30. Konfliktwahrnehmung zwischen direkter Nutzerzuweisung und geerbten Rechten
   - Impact: hoch (falsche Erwartung an die effektive Berechtigung)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Provenance in `me/permissions`/`authorize`, explizite `deny vor allow`-Doku und gezielte Negativtests

31. Einführungsrisiko bei historischer Renummerierung der SQL-Migrationen
   - Impact: mittel bis hoch (falsche Referenzen in Diagnose, Doku oder Acceptance-Operationen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: einheitlicher `goose`-Pfad, repo-weite Referenzaktualisierung, `db:migrate:status` und Schema-Guard parallel verifizieren
