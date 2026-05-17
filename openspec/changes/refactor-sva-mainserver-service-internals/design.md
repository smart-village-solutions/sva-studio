## Context
Der Mainserver-Service ist bereits fachlich breit eingesetzt und durch Routen- und Integrationstests abgesichert. Eine Umstellung darf deshalb weder die öffentliche API noch die deterministische Fehler- und Logging-Semantik verändern. Gleichzeitig soll der Umbau die Hauptverantwortlichkeiten so trennen, dass zukünftige Änderungen an Credentials, Retry-Logik, Transport oder Fachmapping unabhängig voneinander getestet und angepasst werden können.

## Goals
- Öffentliche Service-Fassade und bestehende Top-Level-Helper unverändert lassen
- Infrastruktur- und Fachlogik in klar getrennte interne Module zerlegen
- Fokus auf testbare, kleine Einheiten ohne generische Public-GraphQL-Schnittstelle
- Beobachtbares Verhalten für Fehlercodes, Logs, Retry und Pagination stabil halten

## Non-Goals
- Keine Erweiterung des Public Surface von `@sva/sva-mainserver/server`
- Keine Änderung der Mainserver-Fachsemantik für News, Events oder POI
- Keine Änderung der Pagination-Policy, Retry-Anzahl oder Default-TTLs

## Decisions
- `service.ts` bleibt öffentliche Kompositionsstelle und enthält nur Defaults, Wiring, Config-Laden und Fassade.
- Die Infrastruktur wird in dedizierte Module für Cache, Observability, Credentials, Token und GraphQL-Transport extrahiert.
- News-, Event- und POI-Mapper werden getrennt, gemeinsame Nested-Mappings verbleiben in einem Shared-Mapper-Modul.
- Ressourcenspezifische List/Detail/Write/Delete-Operationen werden in getrennte Module verschoben und greifen nur über interne Ports auf den Transport zu.
- Bestehende Service-Tests bleiben als schmale Wiring-Sicherungen erhalten; detaillierte Verhaltensprüfungen wandern in modulare Unit-Tests.

## Risks / Trade-offs
- Der Refactor verschiebt viele interne Symbole gleichzeitig. Das Risiko wird durch früh laufende Paket-Tests nach jedem Extraktionsblock begrenzt.
- Die zusätzliche Modulstruktur erhöht die Dateianzahl, reduziert aber die Kontextgröße pro Änderung und verbessert die Zielgenauigkeit von Tests.

## Migration Plan
1. OpenSpec und Architekturdokumentation anlegen bzw. fortschreiben
2. Kleine gemeinsame Hilfsbausteine extrahieren und mit fokussierten Tests absichern
3. Transport- und Provider-Logik extrahieren
4. Mapper und ressourcenspezifische Operationen extrahieren
5. `service.ts` auf Fassade reduzieren und Gesamtpaket verifizieren
