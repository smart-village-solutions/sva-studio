## 1. Auth- und Runtime-Haertung

- [ ] 1.1 Session-Characterization-Tests fuer parallele Refreshes gegen Redis-Session-Store ergänzen
- [ ] 1.2 Refresh-Pfad pro `sessionId` serialisieren und konkurrierende Requests auf dasselbe Ergebnis aufloesen
- [ ] 1.3 `/auth/me` auf explizite Response-Allowlist oder Output-Schema umstellen
- [ ] 1.4 In-Memory- und Redis-Session-Store auf gemeinsamen Codec-, TTL- und Konkurrenzvertrag angleichen
- [ ] 1.5 OTEL-SDK im Produktions-Bootpfad vor dem ersten Handler-Mount initialisieren
- [ ] 1.6 Runtime-Readiness und Boot-Checks auf Datenbank-Migrationsdrift erweitern

## 2. Plugin-Vertrag und Host-Grenzen

- [ ] 2.1 Build-time-Registry fuer Route-Kollisionen, Translation-Kollisionen und doppelte Namespaces fail-fast haerten
- [ ] 2.2 Plugin-Permissions gegen das kanonische IAM-Policy-Manifest kreuzvalidieren
- [ ] 2.3 SDK-SemVer-Range-Pruefung beim Registrieren von Plugins einfuehren
- [ ] 2.4 Typisierten Plugin-Route-Vertrag fuer Search-Params, Path-Params und Component-Bindings einfuehren
- [ ] 2.5 Hostkontrollierte Aktivierungsflags fuer build-linked Plugins pro Instanz oder Umgebung verdrahten
- [ ] 2.6 Vollqualifizierte Action-IDs per Lint- oder Build-Gate auch in internen Auth- und IAM-Pfaden erzwingen

## 3. Daten- und Cache-Konsistenz

- [ ] 3.1 Hostvalidierten Invalidation-Tag-Vertrag fuer Mutationen definieren
- [ ] 3.2 Core-App- und Plugin-Mutationen an zentrale Query-Invalidierung anbinden

## 4. CI- und Architektur-Gates

- [ ] 4.1 Dependency-Graph- oder dependency-cruiser-Snapshot als CI-Gate einfuehren
- [ ] 4.2 i18n-Key-Extraktion und Missing-Key-Check in lokale Qualitaetslaeufe und CI aufnehmen
- [ ] 4.3 `.server.ts`-, server-only- und `interfaces-api`-Leak-Gates als statische Pruefungen verankern
- [ ] 4.4 Coverage-Policy fuer kritische Auth-, Registry- und Routing-Pakete in Richtung `85%` ratcheten
- [ ] 4.5 Komplexitaets-Policy fuer offene Auth-Hotspots auf No-Growth und verpflichtende Zerlegung umstellen

## 5. Dokumentation und Entscheidungen

- [ ] 5.1 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `09`, `10` und `11` aktualisieren
- [ ] 5.2 Eine ADR fuer Plugin-Guardrails und Runtime-Boot-Guardrails anlegen oder fortschreiben
- [ ] 5.3 Dokumentierte Uebergangs- und Exemption-Liste fuer bestehende Plugin- und Qualitaets-Abweichungen pflegen
