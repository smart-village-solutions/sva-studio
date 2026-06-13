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
   - Impact: hoch (ein scheinbar grüner Build kann im finalen `.output/server/**` dennoch einen anderen Server-Entry oder Dispatch-Pfad ausliefern)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: finalen Runtime-Vertrag über `verify:runtime-artifact`, `test:release:studio`, runner-basiertes Image-Verify und Precheck-Evidenz zum Ziel-Digest erzwingen; `.nitro/vite/services/ssr/**` nur noch als Diagnosematerial behandeln

2. Geheimnisse in lokalen Env-Dateien
   - Impact: hoch (Credential Leak Risiko)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Secrets rotieren, lokale Env-Dateien strikt aus VCS halten, Secret-Scan in CI

3. Supply-Chain-Drift bei frischen oder vertrauensseitig auffälligen Dependency-Releases
   - Impact: hoch (kompromittierte oder ungewöhnlich veröffentlichte Releases können Lockfile, CI und lokale Installs unbemerkt kippen)
   - Wahrscheinlichkeit: mittel bis hoch
   - Maßnahme: `pnpm@11.3.0` mit `minimumReleaseAge`, `trustPolicy`, expliziter Build-Allowlist und gezielten Overrides/Excludes als verbindlichen Resolver-Schutz nutzen; `pull_request_target`-Workflows ohne Workspace-Install betreiben und Ausnahmen dokumentationspflichtig halten

4. Uneinheitliche Testabdeckung
   - Impact: mittel bis hoch (Regressionen spät erkannt)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Exempt-Projekte schrittweise abbauen, Coverage-Floors erhöhen

5. Routing-Komplexität durch dualen Ansatz (file-based + code-based)
   - Impact: mittel (Fehlkonfiguration/Bundling-Fehler)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: klare Source-of-Truth Regeln und mehr Routing-Tests; die produktive Auth-Registry ist inzwischen auf `packages/routing` konsolidiert, Rest-Risiko bleibt für generelle Route-Komposition

6. Observability-Abhängigkeit von korrekter Initialisierung
   - Impact: mittel (blinde Flecken im Betrieb)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: robuste Startup-Checks und automatische Verifikation der OTEL-Pipeline

7. Dokumentationsdrift bei schnell wandelnden Architekturteilen
   - Impact: mittel
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Doku-Agent Reviews bei Proposal/PR verpflichtend nutzen

8. Globaler Pending-basierter Initial-Loading-Zustand in der Root-Shell
   - Impact: mittel (inkonsistente Wahrnehmung bei langsamen/ schnellen Backends)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Loading-Orchestrierung an echte Pending-/Datenzustände koppeln

9. Statisch verdrahtete Shell-Navigation
   - Impact: mittel (höhere Kopplung, schlechtere Erweiterbarkeit)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Navigationsziele schrittweise über deklarative Route-/Plugin-Metadaten speisen

10. i18n-Schulden in UI-Texten
   - Impact: mittel (A11y-/Lokalisierungsqualität)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: UI-Texte konsistent über Übersetzungsschlüssel (`t('key')`) verwalten

11. Governance-Workflow-Komplexität (Approval, Delegation, Impersonation)
   - Impact: hoch (Fehlfreigaben oder Restberechtigungen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: harte Gates, Negativtests, Ablauf-/Widerrufstests, verpflichtendes Runbook

12. Keycloak-Integrationsdrift bei Claims/Sessionvalidierung
   - Impact: hoch (inkonsistente Identitäts-/Autorisierungskette)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: stabile Claim-Mappings (`sub`, Rollen/Groups), Korrelation in Audit-Events, Integrationstests

13. Scope-Bleeding zwischen IAM-Child-Changes
   - Impact: hoch (unklare Verantwortlichkeit, Architekturdrift, regressionsanfällige Implementierung)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Child-spezifische Delta-Specs strikt einhalten, Scope im PR gegen Masterplan prüfen, Review-Gates vor Implementierungsstart erzwingen

14. Frontend-Task-Drift zwischen Paket-Skripten und Nx-Targets
   - Impact: mittel (uneinheitliche lokale Läufe, unvollständige Cache-Invalidierung, CI-Abweichungen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `sva-studio-react`-Standard-Tasks ausschließlich über dokumentierte Nx-Targets betreiben und Änderungen an Vite/Vitest/Playwright-Konfiguration immer gegen `inputs`/`outputs` prüfen

15. Hohe strukturelle Komplexität in zentralen IAM- und Routing-Modulen
   - Impact: hoch (Refactorings werden riskant, Sicherheits- und Routing-Fehler bleiben schwer lokalisierbar)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: `complexity-gate`, ticketpflichtige tracked findings, Hotspot-Coverage für kritische Dateien

16. Registry-Cache aktuell nur als L1 im App-Prozess
   - Impact: mittel (mehr DB-Last oder inkonsistente Sicht bei mehreren Prozessen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Redis-L2-Cache oder NOTIFY-basierte Cross-Process-Invalidierung als Folgearbeit bewerten

17. Re-Authentisierung für Instanzmutationen aktuell nur als schlanker technischer Nachweis modelliert
   - Impact: mittel bis hoch (Sicherheitsniveau hängt an nachgelagerten Integrationsschritten)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Session-seitig frische Reauth-Zeitmarke und serverseitige Prüfung als nächste Härtung einführen

18. Übergangsphase mit modularen Fassaden und verbleibenden `core.ts`-Hotspots
   - Impact: mittel bis hoch (Reviewer müssen zwischen stabiler API und Restschuld-Kern unterscheiden)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Restschuld nur mit `QUAL-*`-Ticket, klare Doku der Modulgrenzen und inkrementelle Weiterzerlegung

19. Gemischte Token- und Direktfarben im Frontend
   - Impact: mittel (visuelle Inkonsistenz, erschwerte Theme-Pflege)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Shell zuerst vollständig auf semantische Tokens umstellen und Route-Flächen schrittweise nachziehen

20. Theme-Drift zwischen `instanceId`-Auflösung und realem Branding-Bedarf
   - Impact: mittel bis hoch (falsches Branding pro Instanz)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Theme-Mapping zentral halten, Unknown-Fallback definieren und Varianten nur kontrolliert erweitern

21. Prozesslokale Cache-Skalierung in der Mainserver-Integration
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
   - Impact: hoch (lokale Kandidatencontainer können Root-/Tenant-/OIDC-Parität falsch negativ oder unvollständig abbilden)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: prod-nahe Freigaben an Remote-Parität binden, identische Live-Digests nur über dokumentierte Live-Evidenz wiederverwenden und lokale Kandidaten explizit als Hilfssignal behandeln

24. Generische IAM-Rechte ohne Content-Type-Qualifier
   - Impact: mittel bis hoch (Plugins mit unterschiedlichen Content-Typen teilen sich denselben Rechtekanon und können nur begrenzt separat freigeschaltet werden)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `content.read|create|write` in v1 beibehalten, feingranulare Content-Type-Rechte als Folgearbeit getrennt bewerten

25. Rest-Asymmetrie zwischen Kernbereich Content und modulgebundenen Fachbereichen
   - Impact: mittel (das vereinfachte Modell "Modul schaltet Bereich frei, Permission autorisiert Operation" gilt bereits für Media und Plugin-Bereiche, aber bewusst noch nicht für `content.*`)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Content als dokumentierten Sonderfall in UI und Architektur benennen oder in einem separaten Schritt auf ein eigenes Modul-Gate umstellen

26. Untypisiertes `payload_json` als persistente Core-Struktur
   - Impact: mittel (Schema-Drift oder unvollständige Validierung kann erst im Write-Pfad auffallen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: serverseitige contentType-Registry und Zod-Validierung beibehalten, stärkere Persistenztypisierung nur kontrolliert und migrationsgestützt einführen; Mainserver-News umgehen diese Altlast im produktiven Schreibpfad über dedizierte `NewsItem`-Felder und `contentBlocks`

27. Statische Bundle-Plugins statt Runtime-Loading
   - Impact: mittel (geringere betriebliche Flexibilität, Host-Rebuild für neue Plugins erforderlich)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: statische Registrierung als bewussten v1-Trade-off dokumentieren und später nur mit Versionierungs-, Signierungs- und Sicherheitskonzept erweitern

28. Fragmentierter öffentlicher IAM-Diagnosevertrag
   - Impact: hoch (gleiche Symptome werden in UI, Betrieb und Folgeanalyse unterschiedlich gelesen; Refactorings setzen auf unvollständiger Fehlertrennung auf)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: classification-basierten Diagnosekern für Auth, IAM und Provisioning durchziehen; Tenant-Host-, Registry- und Session-Hydration-Fälle liefern jetzt strukturierte Fehlerantworten bis ins Frontend, Restscope bleibt für weitere IAM-Hotspots und Folgechange unter `openspec/changes/refactor-iam-runtime-diagnostics-contract/`

29. Recovery-Pfade kaschieren degradierte IAM-Zustände
   - Impact: hoch (Silent-Recovery, Session-Hydration oder Fallbacks können echte Drift und Teilfehler überdecken)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: degradierte und recovery-nahe Zustände explizit modellieren und UI-/Ops-seitig sichtbar machen, statt nur Endzustände zu berichten; tenantgebundene Sessions ohne `instanceId` sind jetzt fail-closed und werden nicht mehr still aus dem Host rekonstruiert, verbleibende Recovery-Pfade bleiben Folgearbeit

30. Offener Live-Triage-Befund für IAM-Diagnostik
   - Impact: mittel bis hoch (Repo-Analyse deckt reale Host-, Cookie-, Keycloak- und Datenzustandsprobleme nur teilweise ab)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: vorbereitete Szenario-Matrix aus `docs/reports/iam-diagnostics-analysis-2026-04-19.md` gegen reale Dev-/Staging-Umgebung ausführen, bevor der Analysechange als abgeschlossen gilt

31. Restrisiko verbleibender `manual_review`-Fälle im IAM-Abgleich
   - Impact: mittel bis hoch (fachlich mehrdeutige Restfälle bleiben operatorpflichtig und können UI-seitig als unvollständig wahrgenommen werden)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: nur deterministische Auto-Fixes zulassen, Restfälle explizit zählen und operatorseitig mit klaren Folgeaktionen dokumentieren

32. Drift-Blocker und Basis-Health können betrieblich unterschiedlich gelesen werden
   - Impact: hoch (ein grüner Plattformstatus kann weiterhin als fachliche Entwarnung fehlinterpretiert werden)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Drift-Blocker im Root-Host, in Sync-/Reconcile-Fehlern und in den Admin-Ansichten konsistent korrelieren; Diagnosevertrag nicht auf reine Readiness reduzieren

33. Rückfall auf alte Sammelpackage-Importe nach dem Hard-Cut
   - Impact: hoch (neue Fachlogik würde wieder in unklare Ownership laufen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Nx-`depConstraints`, ESLint-Importverbote, `check:server-runtime` und Review-Gates als harte Package-Grenze behandeln

34. UI-Drift zwischen Host-Seiten und Plugin-Custom-Views
   - Impact: mittel bis hoch (Plugins könnten eigene Basiscontrols, Fokusmuster oder visuelle Varianten etablieren und damit Accessibility, Design-System und Review-Aufwand verschlechtern)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: gemeinsame UI-Basis `@sva/studio-ui-react`, ESLint-App-Importverbote, `pnpm check:plugin-ui-boundary` und Review-Regel für fachliche Wrapper statt paralleler Basis-Control-Systeme

35. Event-/POI-Schema-Drift im Mainserver
   - Impact: hoch (verschachtelte Event- und POI-Felder können trotz grünem Build zur Laufzeit von Staging abweichen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Event-/POI-Adapter eng am Snapshot halten, Delete-Record-Types in Staging verifizieren, `openspec validate`, `pnpm check:server-runtime` und Mainserver-Adaptertests vor Rollout ausführen

36. Divergenz zwischen global registrierten Plugins und instanzbezogener Modulfreigabe
   - Impact: hoch (UI oder Routing könnten Module rendern, die fachlich nicht freigegeben sind)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: `assignedModules` als kanonischen Session- und Routing-Kontext verwenden, Plugin-Navigation fail-closed ausblenden und Modul-IAM-Baseline nach jeder Mutation neu herstellen

37. Synchrone Medienverarbeitung im MVP-Upload-Pfad
   - Impact: mittel bis hoch (größere Bilder oder zusätzliche Presets erhöhen Latenz und koppeln Verarbeitungsfehler direkt an Request-Antworten)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Folge-Change `openspec/changes/add-media-async-processing/` für Queue-/Worker-Pfad, Retry-Strategie und entkoppelte Variantenverarbeitung umsetzen

38. Öffentlicher Plugin-Operations-Vertrag könnte vor der ersten Runner-Integration zu früh als vollständig wahrgenommen werden
   - Impact: mittel bis hoch (Consumer bauen auf Start-/Status-API, obwohl Queueing, Dispatch und Retry-Ausführung intern noch nicht vollständig verdrahtet sein können)
   - Wahrscheinlichkeit: mittel

39. Übergang zwischen statischem Plugin-SDK v1 und Plugin-Plattform v2
   - Impact: hoch (Doku, Code und Reviews könnten unterschiedliche Zielbilder mischen und dadurch falsche Implementierungsentscheidungen treffen)
   - Wahrscheinlichkeit: mittel bis hoch
   - Maßnahme: ADR-034 und ADR-041 explizit gegeneinander abgrenzen, Zielrollen für Manifest/Katalog/Loader/Runtime getrennt dokumentieren und direkte App-Importlisten nur noch für echte Übergangspfade zulassen

40. Installierte Plugin-Distributionen sind jetzt vertragsseitig möglich, aber noch nicht über gepackte End-to-End-Smoke-Tests abgesichert
   - Impact: hoch (ein formal kompatibles Paket kann zur Laufzeit trotzdem an Packaging-, Symlink- oder Artefaktgrenzen scheitern)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: dedizierte Installations-Smoke-Tests mit echten gepackten Artefakten und einem `installed-distribution`-Pfad außerhalb des Monorepos ergänzen

41. Host-seitige Runtime-Auflösung ist bisher nur für Plugin-`jobs` generisch, nicht aber für `server`- oder `integrations`-Beiträge
   - Impact: mittel (der Job-Pfad ist entkoppelt, aber weitere pluginseitige Runtime-Beiträge würden noch einen separaten Folgechange benötigen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: den deklarativen Runtime-Contract aus dem Job-Pfad auf `server`- und später `integrations`-Beiträge erweitern, ohne den fail-closed Host-Kontext aufzuweichen

42. Plugin-Architekturdrift durch Brownfield-Ausnahmen und gemischte Package-Rollen
   - Impact: hoch (weitere Plugin-Ausbauten koennen implizite Host-Kopplungen normalisieren und spaet teure Rueckbauten erzwingen)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: `check:plugin-architecture-boundary` im ersten Rollout warn-only auf `packages/plugin-*` betreiben, exakte Altfaelle in `config/plugin-architecture-allowlist.json` pflegen, direkte/relative/Runtime-/Type-/Re-Export-Kanten konsequent sichtbar machen und Mischrollen wie `@sva/studio-module-iam` in einem separaten Folgechange oeffentlich neu schneiden oder pluginseitig verbieten

43. Zentrale Job-Persistenz trägt fachneutrale JSON-Payloads mit begrenzter Schemastrenge
   - Impact: mittel (fachliche Payload-Drift oder unklare Ergebnis-/Fehlerdeutung wird erst in Plugin- oder Runtime-Pfaden sichtbar)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: generische Hostfelder für Progress, Fehlerkategorien, Heartbeat und Event-History stabil halten; pluginfachliche Payload-Schemas weiterhin am Rand validieren

44. Hostinterner Plugin-Operations-Verlauf nutzt vorerst Polling statt Push
   - Impact: mittel (UI-Reaktionszeit und Infrastrukturkosten steigen bei häufigem Polling; Echtzeitwahrnehmung bleibt begrenzt)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: denselben technischen Eventvertrag später hinter Outbox, SSE/WebSocket oder Broker wiederverwenden; vorerst Polling-Frequenz und History-Umfang kontrollieren

45. n8n-/ETL-Integration ist architektonisch vorbereitet, aber noch nicht aus dem Job-Backbone heraus veröffentlicht
   - Impact: mittel bis hoch (Integrationen könnten vorschnell auf interne Tabellen oder Runner-Details zugreifen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Integrationsgrenze später über explizite Outbox-/Event-Verträge öffnen; keine direkte Kopplung an Graphile- oder Tabelleninterna zulassen

### Fortschreibung 2026-06: Restschuld nach Rollenmodell-Trennung

- `roleLevel` bleibt in Rollen-, User- und Audit-Verträgen als Kompatibilitätsfeld sichtbar.
  - Impact: mittel bis hoch (Reviewer können Hierarchie-Logik weiterhin fälschlich als normative Autorisierungsquelle lesen)
  - Maßnahme: separaten Folgechange für den kontrollierten Rückbau von `roleLevel` vorbereiten.
- Historische Altrollen wie `app_manager`, `designer`, `editor` oder `moderator` können in Bestandsinstanzen noch sichtbar sein, obwohl sie nicht mehr zum Sollmodell gehören.
  - Impact: mittel (Operatorsicht und UI können historische Altartefakte noch mit aktiv verwalteten Tenant-Rollen verwechseln)
  - Maßnahme: Read-Model, Runbooks und Cleanup-Migrationen markieren den Altstatus explizit; neue Seeds oder Default-Verträge dürfen diese Rollen nicht wieder einführen.
- Einzelne Governance- und Route-Gates arbeiten weiterhin rollennamenbasiert statt vollständig permission- oder scope-zentriert.
  - Impact: mittel bis hoch (weitere Rollenmodelländerungen bleiben unnötig teuer und regressionsanfällig)
  - Maßnahme: Folgechange für verbleibende rollennamenbasierte Gates priorisieren und gegen ADR-046 prüfen.
   - Maßnahme: generische Grundfelder stabil halten, plugin-spezifische Payloads an registrierte Jobtypen und Importprofile binden und Validierung vor Start sowie bei Worker-Updates kontrolliert ausbauen

46. Stale-Detection für Plugin-Worker ist bisher nur diagnostisch und ohne automatische Recovery
   - Impact: mittel bis hoch (hängende oder verwaiste Jobs werden sichtbar, aber noch nicht aktiv bereinigt oder neu angestoßen)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: die aktuelle Host-Diagnostik über `heartbeatAt`, `lastProgressAt` und `runtime.staleState` als Operator-Signal nutzen; Recovery-, Requeue- oder Dead-Letter-Strategie erst in einem getrennten Folgechange einführen

47. Demo-Runtime der öffentlichen Waste-App kann vom späteren produktiven Read-Pfad abweichen
   - Impact: mittel bis hoch (grüne lokale Auswahl- und E2E-Flows beweisen noch nicht den finalen Server-/Datenpfad)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: vor Produktivsetzung denselben Bürgerfluss gegen die echten öffentlichen Read-Endpunkte und die finale Konfiguration erneut als Integrations- und E2E-Gate absichern

### Technische Schulden (Auswahl)

- Teilweise No-Op Testtargets in Libraries
- Historisch gewachsene Doku mit gemischter Tiefe
- Offene Produktionsentscheidungen für Deployment/HA
- Root-Shell nutzt derzeit einen globalen Router-Pending-Trigger statt datenquellenspezifischer Pending-Orchestrierung
- Shell-Navigation ist aktuell nicht vollständig plugin-/metadatenbasiert
- Reifegrad von Governance-E2E-Tests muss im Produktiv-Rollout weiter erhöht werden
- Risiko von Scope-Bleeding bei schnellen IAM-Iterationen ohne harte Gate-Disziplin
- Mehrere historische IAM-Hotspots sind bewusst als tracked findings mit Refactoring-Backlog dokumentiert
- Nach dem Package-Hard-Cut verbleibt Restkomplexität gezielt in fachlichen Zielpackages wie `auth-runtime`, `iam-admin`, `iam-governance`, `instance-registry` und `data-repositories`; alte Sammelpackages sind dafür kein neuer Zielort.
- `@sva/sdk` ist aus dem aktiven Workspace entfernt; verbleibende Restschuld betrifft nur noch historische Reports und archivierte Referenzen ausserhalb aktiver Normquellen.
- Einige Tests und historische Berichte referenzieren weiterhin alte Pfadnamen; neue fachliche Tests sollen im Zielpackage entstehen und nur dort am Altpfad bleiben, wo Kompatibilität explizit geprüft wird.
- Dünne Host-Bindungen in `apps/sva-studio-react` fuer TanStack-`createServerFn`, Request-Matching und Server-Dispatch bleiben bewusst im App-Layer; Folgearbeit darf diese Transportrolle nicht mit fachlicher Package-Ownership verwechseln.
- Route-Komponenten außerhalb der Shell verwenden noch teilweise direkte `slate-*`-/`emerald-*`-Farben und sind nicht vollständig tokenisiert
- Gruppen sind im ersten Schnitt reine Rollenbündel; direkte Gruppen-Permissions und ein separates Gruppen-Gültigkeitsmanagement pro UI-Flow bleiben Folgearbeit
- Die Geo-Hierarchie ist intern bereits auswertbar, besitzt aber noch keine dedizierte Admin-Oberfläche oder externe Pflegepipeline
- Der Releasevertrag ist im Repo gehärtet, aber produktive Randthemen wie Registry-Promotion, Receiver-Konfiguration und Multi-Node-Betrieb bleiben außerhalb dieses Changes
- Die Live-Paritäts-Wiederverwendung für identische Digests reduziert Drift-Risiko, ersetzt aber keinen späteren echten Off-Cluster-Paritäts-Pfad für neue Digests
- Plugin-Registrierung ist jetzt metadatenbasiert, aber noch nicht runtime-dynamisch
- Content-Payloads bleiben in Postgres generisch als JSON abgelegt; Typsicherheit wird aktuell im Serververtrag und nicht in der Datenbank erzwungen
- Medienvarianten werden im MVP synchron beim Upload-Abschluss erzeugt; ein entkoppelter Async-Worker ist als Folgearbeit unter `openspec/changes/add-media-async-processing/` vorgesehen

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

16b. Login-basierte Inaktivität ist nur ein Näherungswert
   - Impact: mittel bis hoch (Accounts können zwischen letztem Login und tatsächlicher letzter Nutzung fachlich später aktiv gewesen sein)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: V1 bewusst auf Login-Events begrenzen, UI klar auf diese Quelle hinweisen und spätere Aktivitätssignale nur in einem separaten Folge-Change ergänzen

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
   - Maßnahme: Contract-Tests für Governance-/DSR-Mapper, synchrone Pflege von OpenSpec, API-Guide und OpenAPI sowie gezielte Review-Gates bei Feldänderungen; für Permission-Transparenz bleiben insbesondere `runtimeScope` und das Fehlen künstlicher `organizationId`-Bindungen bei instanzweiten Rechten prüfrelevant

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

32. Restliche mentale Last durch historisch gewachsene Rollen- und Rechtebilder
   - Impact: mittel (Admin-UI bleibt trotz vereinfachter Gates erklärungsbedürftig)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Fachbereiche strikt über `Modulzuweisung + namespace.read` sichtbar machen, kanonische punktgetrennte Permission-IDs zentralisieren und Modul-/Rollen-Semantik im UI explizit erklären
