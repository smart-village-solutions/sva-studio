## 0. Sichtbarkeit ohne Blockade

- [x] 0.1 Report-only Guardrail-Runner mit menschenlesbarer und JSON-fähiger Ausgabe einführen
- [x] 0.2 `env:doctor:studio` und `env:precheck:studio` um additive Guardrail-Checks erweitern, ohne neue `error`-Gates zu erzeugen
- [x] 0.3 Report-only Checks für Plugin-Vertrag, Architekturdrift, Runtime-Boot, Auth-Session und Cache-Vertrag verdrahten
- [x] 0.4 Erste Befunde aus dem report-only Lauf dokumentieren und als Grundlage für spätere Enforcement-Slices festhalten

> Standabgleich 18.06.2026: Der inhaltliche Review des Alt-PRs `#441` bestaetigt, dass keine Reanimation des Branches noetig ist. Die noch relevanten Restpunkte sind bereits durch die offenen Tasks dieses Changes abgedeckt, insbesondere `1.1` bis `1.4`, `2.1` bis `2.3`, `3.1` bis `3.2` und `4.3`.

## 1. Auth- und Runtime-Härtung

- [ ] 1.1 Session-Characterization-Tests für parallele Refreshes gegen Redis-Session-Store ergänzen
- [ ] 1.2 Refresh-Pfad pro `sessionId` serialisieren und konkurrierende Requests auf dasselbe Ergebnis auflösen
- [ ] 1.3 `/auth/me` auf explizite Response-Allowlist oder Output-Schema umstellen
- [ ] 1.4 In-Memory- und Redis-Session-Store auf gemeinsamen Codec-, TTL- und Konkurrenzvertrag angleichen
- [ ] 1.5 OTEL-SDK im Produktions-Bootpfad vor dem ersten Handler-Mount initialisieren
- [ ] 1.6 Runtime-Readiness und Boot-Checks auf Datenbank-Migrationsdrift erweitern

## 2. Plugin-Vertrag und Host-Grenzen

- [ ] 2.1 Build-time-Registry für Route-Kollisionen, Translation-Kollisionen und doppelte Namespaces fail-fast härten
- [ ] 2.2 Plugin-Permissions gegen das kanonische IAM-Policy-Manifest kreuzvalidieren
- [ ] 2.3 SDK-SemVer-Range-Prüfung beim Registrieren von Plugins einführen
- [ ] 2.4 Typisierten Plugin-Route-Vertrag für Search-Params, Path-Params und Component-Bindings einführen
- [ ] 2.5 Hostkontrollierte Aktivierungsflags für build-linked Plugins pro Instanz oder Umgebung verdrahten
- [ ] 2.6 Vollqualifizierte Action-IDs per Lint- oder Build-Gate auch in internen Auth- und IAM-Pfaden erzwingen

## 3. Daten- und Cache-Konsistenz

- [ ] 3.1 Hostvalidierten Invalidation-Tag-Vertrag für Mutationen definieren
- [ ] 3.2 Core-App- und Plugin-Mutationen an zentrale Query-Invalidierung anbinden

## 4. CI- und Architektur-Gates

- [ ] 4.1 Dependency-Graph- oder dependency-cruiser-Snapshot als CI-Gate einführen
- [ ] 4.2 i18n-Key-Extraktion und Missing-Key-Check in lokale Qualitätsläufe und CI aufnehmen (report-only Heuristik existiert bereits, Enforcement fehlt)
- [ ] 4.3 `.server.ts`-, server-only- und `interfaces-api`-Leak-Gates als statische Prüfungen verankern (aktuell nur report-only Heuristik, inklusive Triage von False Positives)
- [ ] 4.4 Coverage-Policy für kritische Auth-, Registry- und Routing-Pakete in Richtung `85%` ratcheten
- [ ] 4.5 Komplexitäts-Policy für offene Auth-Hotspots auf No-Growth und verpflichtende Zerlegung umstellen

## 5. Dokumentation und Entscheidungen

- [ ] 5.1 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `09`, `10` und `11` aktualisieren
- [ ] 5.2 Eine ADR für Plugin-Guardrails und Runtime-Boot-Guardrails anlegen oder fortschreiben
- [ ] 5.3 Dokumentierte Übergangs- und Exemption-Liste für bestehende Plugin- und Qualitäts-Abweichungen pflegen
- [ ] 5.4 Report-only Warnungen in `nur Architekturdrift`, `bewusst serverseitig`, `funktionales Risiko` triagieren und dokumentieren
