# Lieferplan: drei Studio-PRs

Alle Implementierungs- und Abnahmenachweise sind offen. Der vorhandene Analyse-Testlauf (38 Tests in drei Auth-Runtime-Dateien am Basisstand) ist lediglich Baseline, kein Nachweis der neuen Invarianten. PR 1 startet als Proposal-Draft; die menschliche Freigabe erfolgt vor seinem ersten Codeblock. PR 2 und PR 3 werden erst nach Merge ihres Vorgängers von aktuellem `main` eröffnet.

## 1. PR 1 — Klassifikation, Fehlerreferenz und Diagnose

- [ ] 1.1 Vollständigen Change einschließlich Scope, drei PR-Aufträgen und Assurance Case menschlich prüfen und zur Implementierung freigeben; Planungsevidenz nicht als Implementierungsfreigabe auslegen.
- [ ] 1.2 Die Eintrittsmatrix aus `design.md` gegen aktuellen HEAD prüfen, Verbraucher und bestehende Tests zuordnen; externe Mainserver-Verträge unverändert festhalten.
- [ ] 1.3 Alle bestehenden Principal-/Credential-Ergebnisse exhaustiv klassifizieren; `partial_credentials` reproduzieren und als Konfigurationsfehler statt 403 absichern; vorhandene, nicht freigegebene Organisations-Credentials sicher unterscheidbar machen.
- [ ] 1.4 Vorhandene Request-/Response-Grenze für frühe Response-Returns und Exceptions erweitern: genau ein abschließendes Ergebnisereignis, sichere Route/Phase/Action und identische `X-Request-Id`; bisherige operative Duplikate im selben Lieferabschnitt entfernen, eigenständige Audits erhalten.
- [ ] 1.5 Request-ID und sichere Diagnose additiv durch IAM-/Mainserver-Clients, Error-Factories und vorhandene Plugin-/Host-Fehleranzeigen transportieren; Fehlerreferenz zugänglich und kopierbar in `de`/`en` anbieten.
- [ ] 1.6 Den begrenzten Browser-Meldepfad ausschließlich im bestehenden Monitoring ergänzen: Session, CSRF, Instanzbindung, striktes Schema, 2-KiB-Limit, Rate-Limit in einem eigenen Telemetrie-Bucket und atomare instanz-/accountgebundene Deduplizierung; fachliche Budgets bleiben unverändert, Clientbeobachtung bleibt unbestätigt. Budget/Dedupe in PR 1 für die unterstützte Topologie nachweisen.
- [ ] 1.7 Offline-/Auth-Fehler der Telemetrie ohne Rekursion, fachliche Blockierung oder Datenpersistenz behandeln; Annahme-ACK und Loki-Zustellung getrennt ausweisen.
- [ ] 1.8 Tabellengetriebene Klassifikations-, Early-Return-, Header/SDK/UI-Korrelations-, Duplikat-/PII- und Browser-Rate-Limit-Tests ergänzen; den kleinsten echten Unit-/Type-Gate unmittelbar je Block ausführen.
- [ ] 1.9 Arc42 04/05/06/08 prüfen und betroffene Aussagen, vorhandene Logging-/Mainserver-Runbooks sowie Fehlerdokumentation fortschreiben; ADR-018 für verbindliche Header-/Browserdiagnostik und weitere betroffene ADRs samt Architekturindex fortschreiben.
- [ ] 1.10 Gezielte Projektgates, Server-Runtime, OpenSpec, Dokumentations- und Placement-Checks ausführen; exakten finalen HEAD einmal über die GitHub-Gates bis terminal verfolgen.
- [ ] 1.11 Nach gesonderter Freigabe in Staging eine sichere frühe Ablehnung mit Referenz tatsächlich in Loki nachweisen; Exportausfall erkennbar und ohne behauptete Zustellgarantie prüfen. PR 1 erst mit seiner direkten Evidenz als implementiert abnehmen.

## 2. PR 2 — Session- und Organisationskonsistenz

- [ ] 2.1 Nach Merge von PR 1 von aktuellem `main` abschneiden, Scope und tatsächliche unterstützte Prozess-/Deploymenttopologie prüfen; vorhandene Store-/Claim-Primitiven vor neuer Eigenlogik untersuchen.
- [ ] 2.2 Refresh-Fallback mit gesetzter Organisation fehlschlagend reproduzieren; vollständige Sessionprojektion erhalten, ohne Gültigkeit, Rollen oder Principal zu erweitern.
- [ ] 2.3 Im bestehenden Redis-Store atomare vergleichsgeprüfte Feldänderungen einführen; Konfliktzahl begrenzen, nach Konflikt frisch lesen und nie gelöschte/abgelaufene/widerrufene Sessions wiederanlegen.
- [ ] 2.4 Refreshes für dieselbe Session topologiegerecht koordinieren; stale Token-Commits verwerfen und nach Warten aktuellen autoritativen Zustand verwenden. Kein neuer allgemeiner Lock-Service.
- [ ] 2.5 Organisationsreads/-wechsel im vorhandenen Browserprovider an Benutzer, Tenant und Sequenz binden; Wechsel serialisieren, überholte Antworten verwerfen und unklare Write-Ergebnisse zuerst nachlesen.
- [ ] 2.6 Deterministische Unit-Interleavings und echte Redis-Integration für beide Commit-Reihenfolgen, Refresh/Refresh, Update/Logout, gesonderten Widerrufsmarker bei noch vorhandenem Session-Key, Ablauf und Verbindungsfehler ergänzen; Verschlüsselung, TTL und Widerruf erhalten.
- [ ] 2.7 Deferred-Promise-Tests für alten GET nach bestätigtem PUT, zwei Wechsel, Logout/Userwechsel während Read und Fehler-Recovery ergänzen; keine stale UI-Publikation.
- [ ] 2.8 Arc42 04/05/06/08, ADR-023/ADR-050 samt 09 und konkrete Session-/Organisationsdokumentation fortschreiben; keine DB-Schemaänderung ohne neuen Scopeentscheid.
- [ ] 2.9 Gezielte Auth-/IAM-Admin-/Providergates, erforderliche Security-/Redis-Integrationsgates und `pnpm check:server-runtime` ausführen; direkte Evidenz am finalen HEAD sammeln und GitHub-Gates terminal abwarten.
- [ ] 2.10 Session-Kompatibilität, Widerruf und Rollback gemäß bestehendem Studio-Rolloutvertrag nachweisen; keine neue Mehrreplika- oder Keycloak-Konfiguration als versteckte Voraussetzung.

## 3. PR 3 — UI-Freigaben, Readiness und Editor-Recovery

- [ ] 3.1 Nach Merge von PR 2 von aktuellem `main` abschneiden; die aktuellen Consumer von Route-Guard, Effective Access, Principal-Binding und Standard-Content-Editoren gegen den Change prüfen.
- [ ] 3.2 Bestehende Auth-/Org-/Access-Provider über Identitäts-/Kontextgeneration und deduplizierte Wiederaufnahme-/Recovery-Trigger verbinden; gleiche Rollen-/Modulnamen dürfen Revalidierung nicht verhindern.
- [ ] 3.3 Route-Guards auf dieselbe aktuelle Access-Quelle umstellen und den alten unabhängigen Route-Permission-Read im selben PR entfernen; weiterhin keine UI-Freigabe aus `/auth/me.permissionActions`.
- [ ] 3.4 Ressourcen-403 lokal behandeln; ausschließlich explizite Stale-/Scope-Signale gezielt invalidieren und Code, Tests, ADR-050 sowie UI-Enforcement-Dokumentation angleichen.
- [ ] 3.5 `stale_mainserver_context` bis zur Fehleranzeige erhalten, altes Binding und Ressourcenfreigaben verwerfen sowie Kontext/Detail neu lesen; Entwurf und Form-/Medienrevision bewahren, Principalwechsel ausdrücklich bestätigen lassen.
- [ ] 3.6 Vorhandene lokale Principal-Projektion um sichere Credential-/Provisioning-Readiness ergänzen und Create-Verfügbarkeit daraus ableiten; kein Secret, keine Upstream-Probe, kein Provisioning/Recovery-Write und keine Änderung externer Verträge.
- [ ] 3.7 Fehlendes Recht ausblenden, technische Readiness dagegen begründet sperren; nach explizitem Reload neu prüfen. Fehler-/Retryflächen zugänglich, deutsch und englisch halten.
- [ ] 3.8 Persona-/Scope-/Readiness-Matrix aus `design.md` durch gezielte Unit- und Browser-Tests absichern; Zwei-Tab-Wechsel, Wiederaufnahme, Ablauf, unveränderte Rollennamen und eigene/organisatorische Principalwahl einbeziehen.
- [ ] 3.9 E2E nachweisen: Kontext-Recovery erhält Entwurf, fordert kein automatisches POST/PATCH/DELETE an, respektiert bestätigte/unklare Ergebnisse und zeigt dieselbe Fehlerreferenz wie API/Log. Tastatur-Submit ohne Recht verhindern.
- [ ] 3.10 Arc42 04/05/06/08, ADR-050 samt 09, betroffene Nutzer-/Plugindokumentation und bestehende Readiness-/Recovery-Runbooks fortschreiben; ersetzte Ausführungspfade entfernen.
- [ ] 3.11 Gezielte UI-/SDK-/Fassaden-/Plugingates und Server-Runtime ausführen; vor breitem affected-Run Scope messen. Abschließend exakten HEAD, direkte Evidenz und terminale GitHub-Gates prüfen.
- [ ] 3.12 Studio-only-Abnahme und den kanonischen Rollout belegen; ausschließlich tatsächlich ausgeführte Evidenz markieren. Change erst nach vollständiger Lieferung und gesondertem Archivierungsauftrag archivieren.

### Bestehende Prüfwege für die Umsetzung

Targets und Dateipfade werden am jeweiligen PR-HEAD zuerst mit `pnpm nx show project <projekt> --json` geprüft. Dateifilter bleiben `--testFiles=...`; keine neue Testsuite, kein neuer Gate-Wrapper. Konkrete Einstiege:

```sh
pnpm nx run auth-runtime:test:unit --testFiles=src/auth-server/session.test.ts --testFiles=src/mainserver-mutation-principal.test.ts --testFiles=src/iam-authorization/permission-store.test.ts
pnpm nx run sva-studio-react:test:unit:hooks --testFiles=src/hooks/use-organization-context.test.tsx --testFiles=src/lib/iam-api.test.ts
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/providers/effective-access-provider.test.tsx
pnpm check:server-runtime
pnpm nx show projects --affected --withTarget=test:unit --base=origin/main
pnpm exec openspec validate harden-studio-access-resilience --strict
pnpm check:docs
pnpm check:file-placement
```

Die Redis-Integrations- und Browser-Szenarien werden in vorhandene zuständige Targets eingeordnet. Für Sicherheits-, Session- und Datenintegritätsänderungen bleiben die besonderen Pflicht-Gates aus `DEVELOPMENT_RULES.md` maßgeblich. Proposal-Validierung benötigt keine Wiederholung von Laufzeit-/Vollsuite-Tests.
