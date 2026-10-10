# Design und automatisierbare Abnahme

## Codebefunde

Baseline `1cab0ade9`; Zeilen sind Suchanker und vor Implementierung erneut zu prüfen.

| Problem | Codebeleg | Lösung im bestehenden Pfad |
| --- | --- | --- |
| App implementiert Fachoperationen | `apps/sva-studio-react/src/lib/waste-management-operations.runtime.server.ts:27–52`, `waste-management-operations.handlers.server.ts:85–103`, `waste-management-operations.import.persist.ts:23–85` | Operationen, Import/Export, Schema-, Sync-, Reminder- und Provisionierungslogik mit Tests nach Waste-Runtime verschieben; App liefert technische Dependencies |
| Jobloader kennt Waste-ID und spezielle Jobtypen | `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.ts:51–55,69–85,138–145`; Waste-Manifest ohne `jobs`-Entry | Vorhandenen Manifest-/Jobloader verwenden; Runtime über validierten Vertrag binden; kein Waste-Fallback |
| Allgemeine Endpunkte entscheiden fachlich | `packages/auth-runtime/src/plugin-operations/core.start.ts:34–41`, `core.artifacts.ts:45–53` | Bestehenden Jobvertrag um genau benötigte Start-/Downloadanforderungen ergänzen oder Fachentscheidung im bestehenden Waste-Handler halten; technische Sicherheitsprüfungen zentral belassen |
| Instanzverwaltung ist an Waste-Antwort gekoppelt | `packages/instance-registry/src/service-detail.ts:93–97`, `service-types.ts:131,142,288–291`; `auth-runtime/src/iam-instance-registry/instance-registry-deps.ts:3–6,36–37` | Basisdetail zurück auf generischen Typ; belegte Settings-Verbraucher aus vorhandenem Waste-Pfad bedienen; tote Legacy-Helper nach Export-/Verbraucherprüfung löschen |
| Host besitzt Waste-Persistenz und Auditinterpretation | `auth-runtime/src/waste-management/waste-data-sources.server.ts:114–145`, `data-repositories/src/instance-registry/repository-waste-provisioning.ts:41–74`, `iam-governance/src/waste-audit-read-models.ts:33–57` | Fachadapter/Projektionen in Waste-Runtime; zentrale Speicherung und tenantgebundene technische DB-/Audit-Fähigkeiten weiter Host-owned |
| Plugin bezieht Auth-Fassade direkt | `plugin-waste-management/src/server-context.ts:1–11`, `src/server-loaders.ts:1–19`; `auth-runtime/src/plugin-server-host.ts:69–89` | Benötigte Host-Fähigkeiten öffentlich über bestehenden SDK-/Execution-Vertrag injizieren; keine rohe Host-Fassade oder universeller Service-Locator |
| Ausnahmen sind im Checker fest eingebaut | `scripts/ci/plugin-architecture-boundary-workspace.ts:10–18,89–102` | Host-Ausnahme entfernen; gezielte blockierende Waste-Regressionstests im vorhandenen Checker; fachinterne Waste-Abhängigkeiten ausdrücklich zulässig |

Bereits vorhanden und zu bewahren: generischer Snapshot-HTTP-Loader; `plugin-server-runtime.server.test.ts:72–89` beschreibt fehlendes Plugin und alle 62 aktuellen HTTP-Bindungen. Ein neuer Waste-Dispatcher ist nicht nötig.

## Entscheidungen

### 1. Ownership verschieben, Ausführungsmodell behalten

`@sva/waste-management-contracts` bleibt Owner browserfähiger Fachverträge; `@sva/waste-management-runtime` erhält die restliche serverseitige Fachausführung. Plugin-Descriptor, Browser-, Server- und Job-Entries bleiben getrennt. Der vorhandene Job-Entry der Runtime wird für den installierten Pluginbeitrag über den existierenden Manifest-/Package-Ladeweg erreichbar gemacht; nur wenn nötig erhält das bestehende Plugin einen kleinen eigenen Entry, keinen neuen Loader.

App/Host dürfen am bestehenden Composition-Punkt Mail-, Secret-, DB- und Transportfähigkeiten bereitstellen. Die zentrale Queue, Actor-Auflösung, Authentifizierung, Rechteentscheidung und privilegierte Worker-Lane bleiben Host-owned. Ein fachliches Runtime-Package ist kein zusätzlicher Dienst.

### 2. Verträge nur um belegte Bedürfnisse erweitern

Der aktuelle `PluginJobTypeDefinition` enthält noch keine Start-/Artefakt-/Lane-Policy; das Manifest unterstützt bereits `entryPoints.jobs` und `runtimeRequirements.jobs`. Bestehende Felder werden genutzt. Neue Felder sind nur für aktuell nachgewiesene Waste-Startbeschränkung, Exportberechtigung, Abbruchfähigkeit oder privilegierte Ausführung zulässig und müssen von Deklaration bis Ausführung im selben Snapshot validiert werden.

Keine frei konfigurierbaren Policy-Ausdrücke, beliebigen Callbacks oder neue Provider-Registry. Ein Plugin darf privilegierte Ausführung nicht allein durch selbst deklarierte Metadaten erhalten: Der Host prüft die begrenzte technische Fähigkeit; unbekannte oder nicht freigegebene Werte verhindern Registrierung/Ausführung. Fehlende Metadaten erhalten einen sicheren, für andere bestehende Plugins kompatiblen Default; sie dürfen keine zusätzliche Start- oder Downloadberechtigung erzeugen.

Der direkte Import von `@sva/auth-runtime/plugin-server-host` entfällt. Der bestehende Server-Execution-Vertrag wird nur um benötigte Fähigkeiten ergänzt. Der authentifizierte Request-Kontext des Dispatchers wird genutzt, statt ihn bei jedem Waste-Aufruf erneut aufzulösen; fachabhängige Zusatzrechte wie Tourkopien bleiben explizit geprüft. Rohe Secrets, Runner-Interna und ungebundene Registry-Zugriffe werden nicht veröffentlicht.

### 3. Persistenzownership ohne Datenmigration

Waste-spezifische SQL-Statements, Zustandsübergänge und Audit-Mappings ziehen mit ihren Tests in die Waste-Runtime. Bestehende Studio-Tabellen dürfen physisch bestehen bleiben; die generische Host-DB-Fähigkeit setzt weiterhin Tenant-Kontext/RLS und Transaktionsgrenzen. Eine eigene neue Waste-Metadatenbank ist für diesen Schnitt nicht erforderlich.

Die allgemeine Instanzverwaltung lädt keine Waste-Einstellungen mehr. Vor Umstellung werden Browser-, Public-Waste-, API-/SDK- und externe bekannte Verbraucher inventarisiert. Bestehende Waste-Settings-Endpunkte werden bevorzugt. Wenn ein nachgewiesener externer Vertrag nicht koordiniert umgestellt werden kann, wird der Lieferabschnitt vor Codeänderung neu zugeschnitten; keine spekulative Kompatibilitätsschicht.

### 4. Physische Optionalität mit vorhandenem Profil nachweisen

Das SSF-Profil ist bereits eine Distribution ohne Waste-Plugin. Bestehende Build-, Deploy-Pruning- und Runtime-Artefaktprüfungen werden genutzt, um auch Waste-Contracts/Runtime und transitive Host-Imports auszuschließen. Ein leeres Snapshot-Mock oder ein fehlendes Menü ist kein Nachweis für physische Optionalität. Ebenso ersetzt eine Textsuche im minifizierten Bundle keinen Import-/Chunk- und Laufzeitnachweis.

Workspace-Code darf weiterhin alle Plugins enthalten. Entscheidend ist das ausgelieferte SSF-Artefakt: Waste-Pakete sind weder enthalten noch beim Start oder generischen Hostzugriff erforderlich. Das Studio-Profil mit Waste muss unverändert funktionieren. Kein neues Core-only-Profil.

## Kritische Invarianten und Failure Modes

| Invariante | Gefahr beim Refactor | Geplanter Nachweis |
| --- | --- | --- |
| Tenant und Actor stammen aus Host-Kontext | Fremder Tenant oder wechselnder Actor erreicht SQL/Job | Negativtests plus echte DB-/RLS-Prüfung; Fachhandler/Enqueue/SQL werden bei Ablehnung nicht erreicht |
| Permissions, Zusatzrechte und CSRF bleiben wirksam | Generischer Job-/Downloadpfad umgeht Waste-Checks | Gültige Baseline und je einzeln fehlende Permission, Zusatzrecht, CSRF, Aktivierung; keine erfolgreichen Side Effects |
| Provisionierung bleibt privilegiert | Metadaten erlauben DDL im App-/Default-Worker | Default-Lane lehnt Provisionierungsjob ab; Host-Allowlist und echte Principal-/Queue-Vertragsprüfung |
| Transaktion, Idempotenz, Retry und Cancellation bleiben erhalten | Halbe Importe/Jahreswechsel oder doppelte Nebenwirkungen | Vorher-/Nachher-Fixtures, Rollback/Replay und konkurrierender Claim in PostgreSQL; Jobtests für Retry/Abbruch |
| Fachdaten/Audit/Artefakte bleiben kompatibel | Ownership verschiebt Ergebnisse oder verliert Historie | Deterministische Vergleichsfixtures, Actor-/Tenant-/Expiry-/Checksum-Negativtests, bestehende History lesen |
| Ohne Plugin keine Fachausführung | Statischer Import/Fallback benötigt Waste trotzdem | Auflösung ohne Waste-Pakete, Chunk-/Deploy-Provenienz, Boot-/Health-/generische Host-Probes des finalen Artefakts |

## Abnahmekriterien

Alle Kriterien sind am exakten finalen Code-HEAD nachzuweisen. Keine Abnahme allein durch Checkboxen, Mock-Erfolg oder KI-Einschätzung. Tests werden im bestehenden Vitest-/Nx-Pfad erweitert, nicht über einen neuen Runner.

| ID | Pass-Kriterium | Automatisierter Nachweis / KI-Aufgabe |
| --- | --- | --- |
| A1 | App enthält keine Waste-Fachoperationen mehr; ersetzte Dateien/Pfade sind gelöscht, verbleibende Composition ist technisch | Bestehende Importanalyse und gezielte Boundary-Tests; KI prüft jede verbleibende Produktionskante und Dateiverschiebung gegen die Befundtabelle. Keine Ausnahmen nur durch Umbenennen |
| A2 | Waste-Jobs werden ausschließlich aus dem validierten Beitrag geladen; keine Waste-ID-Matrix/Fallback-Factory | Reale Descriptor-/Job-Entry-Integration für Workspace und installiertes Paket; leeres Snapshot registriert null Waste-Jobs; fehlender Entry, Runtime, doppelte/undeclarierte Handler scheitern vor Registrierung |
| A3 | Start-/Export-/Abbruch-/Privilegierungsregeln entsprechen dem bisherigen Verhalten ohne fachliche Branches im generischen Host | SDK-/Loader-/Host-Contracttests einschließlich zweitem synthetischen Namespace; unbekannte/fremde Privilegierungsmetadaten abweisen; generischer Start darf dedizierte Fachprüfung nicht umgehen |
| A4 | Waste-eigene Settings/Persistenz/Auditprojektion sind vom generischen Instanzvertrag gelöst | Typ-/Importtests ohne Waste-Fachpakete; reales Instanzdetail ohne Waste-Loaderaufruf; vorhandene Waste-Settings-/History-Verbraucher liefern dieselben Fachwerte und lesen historische Daten |
| A5 | Plugin importiert keine Auth-/IAM-/App-Interna; Host-Fassade enthält keine Waste-Fachmethoden | Vorhandenen Importchecker auf Waste strikt prüfen, einschließlich transitiver Server-Imports und package.json; Regressionstests für verbotene Kanten. Warn-only CLI allein zählt nicht als bestanden |
| A6 | Bestehende HTTP-/Job-Fachverträge und Sicherheitsgrenzen bleiben erhalten | Alle baseline-erfassten Methoden/Pfade (derzeit 62), Status-/Fehlerantworten und Zusatzrechte prüfen; Auth-/Tenant-/Permission-/CSRF-/Lifecycle-Negativfälle dürfen weder Fachhandler noch Job/SQL erreichen; Scope Root/Tenant bleibt getrennt |
| A7 | Migration der Fachausführung erhält Datenintegrität und Nebeneffekte | Bestehende PostgreSQL-Integration für Jahreswechsel/Rollback/Idempotenz plus die tatsächlich verschobenen Import-/Provisionierungs-/Claim-Pfade; deterministic Fixtures für Import/Export, Sync und Reminder mit Transport-Testdoubles; kein realer Mailversand oder produktiver Reset |
| A8 | Finales SSF-Artefakt ist ohne sämtliche Waste-Pakete lauffähig; Studio-Artefakt mit Waste funktioniert | Bestehende Distributions-/Pruning-/Chunkprüfung und `verify:runtime-artifact` für beide Profile. SSF: Pakete und transitive Imports fehlen, Boot/Health und generischer Instanz-/Jobzugriff funktionieren, Waste-Endpunkt führt nichts aus. Studio: echte Server-/Job-Entries sind auflösbar; automatisierter Browser-Smoke für Settings, eine Mutation und Jobstatus mit synthetischen Daten |
| A9 | Oberfläche wird kleiner und Nachweise sind vollständig nachvollziehbar | KI gleicht git diff, gelöschte Host-Sonderfälle, verbleibende Importkanten, Tests und Artefaktberichte ab. Keine neuen Packages/Services/Workflows; keine neue Ausnahme/Shadow-Runtime. Ergebnis je A-ID mit SHA, Befehl/Testname oder CI-Link und PASS/FAIL/BLOCKED |

### Ausführung und Evidenz

Kleinster Test pro geändertem Block; bei rotem Stand keine weitere Implementierung. Vor affected-Läufen Scope messen: `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main`; bei mehr als sechs Projekten gezielte Projekt-/Dateitests und breite Endprüfung in CI.

Vorhandene verifizierte Targets/Befehle:

- `pnpm nx run waste-management-runtime:test:unit --testFiles=<betroffene-testdatei>` und entsprechend `plugin-waste-management`, `auth-runtime`, `instance-registry`, `iam-governance`, `data-repositories`, `plugin-sdk`.
- App-Servertests: `pnpm nx run sva-studio-react:test:unit:server --testFiles=<betroffene-testdatei>`; passende UI-/Routes-Slices für die direkt geänderten Verbraucher.
- `pnpm nx run <betroffenes-projekt>:test:types`; `pnpm check:server-runtime` früh bei serverseitiger Vertragsänderung; Skriptänderungen zusätzlich `pnpm exec tsc -p tsconfig.scripts.json --noEmit`.
- Bestehende DB-Gates: `pnpm nx run auth-runtime:test:integration`, `pnpm nx run sva-studio-react:test:integration`; tatsächliche Ausführung der relevanten Tests nachweisen, nicht nur einen erfolgreichen Lauf mit übersprungenen Fällen.
- `SVA_STUDIO_DISTRIBUTION=ssf pnpm nx run sva-studio-react:verify:runtime-artifact` und entsprechend `studio`; bestehende Paketierungs-/Pruning-Assertions erweitern. Profile sequentiell ausführen, damit Artefaktpfade nicht überschrieben werden.
- `pnpm check:plugin-architecture-boundary`, `pnpm check:plugin-ui-boundary`, `pnpm check:file-placement`; für A5 zusätzlich blockierender Waste-spezifischer Test im vorhandenen Checkertest, kein neuer CLI-Wrapper.

Dateifilter und konkrete Testnamen werden im Implementierungsabschnitt anhand der migrierten Dateien festgehalten. Für Browser-/Artefaktprobes werden bestehende Test-/Verify-Einstiege erweitert; keine neue Test-App. Der Agent liefert eine kurze A1–A9-Tabelle im PR-Nachweis, kein neues dauerhaftes Governance-Dokument. Die KI prüft Ausgaben und Diff; sie kann fehlende DB-/Artefakt-/Browser-Evidenz nicht durch Begründung ersetzen. Falls Infrastruktur fehlt, lautet das Kriterium BLOCKED mit genauer Voraussetzung, nicht „Nutzer muss manuell testen“.

## Lieferfolge und Rücknahme

1. Fachoperationen samt Tests verschieben und technische Dependencies injizieren; bisheriger Host-Einstieg ruft zunächst nur die neue Implementierung auf, ohne alten Fachpfad weiterzuführen.
2. Job-/Serverbeiträge und Sicherheits-Policies im bestehenden Vertrag schließen; gleichzeitig Sonderregistrierung und direkte Auth-Kante entfernen.
3. Instanzdetail-/Audit-/Persistenzverbraucher umstellen, verbleibende Host-Kopplung entfernen, physische Optionalität und Browser-Smoke nachweisen.

Jeder Abschnitt muss eigenständig grün sein; PR-Anzahl richtet sich nach tatsächlich unabhängigen Zwischenständen. Keine späte mechanische Zerteilung. Bei Rücknahme den betroffenen Code-/Vertragsabschnitt gemeinsam zurücknehmen; keine Datenmigration ist vorgesehen. Unerwartete externe Verbraucher, notwendige Schemaänderungen oder neue technische Schichten stoppen den jeweiligen Abschnitt und verlangen einen engeren neu geprüften Zuschnitt.
