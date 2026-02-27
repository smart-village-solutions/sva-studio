# Design: Child C – IAM Authorization API und RBAC v1

## Kontext

Child C implementiert den ersten stabilen Autorisierungspfad auf Basis von Child B. Fokus ist ein deterministischer RBAC-Contract mit nachvollziehbaren Entscheidungen.

## Ziele

- Stabile Endpunkte `GET /iam/me/permissions` und `POST /iam/authorize`
- Deterministische Entscheidungen (`allowed` + `reason`)
- Striktes `instanceId`-Scoping
- Wiederverwendbare SDK-Integration für Fachmodule

## Architekturentscheidungen

1. Trennung von API-Contract und Evaluations-Engine
2. RBAC v1 ohne ABAC-Regeln; ABAC folgt in Child D
3. Reason-Code-Katalog als verpflichtender Teil des API-Vertrags
4. Organisatorischer Kontext als Sub-Scope unter `instanceId`

## Laufzeitfluss `POST /iam/authorize`

1. Authentifizierung und Auflösung des Benutzerkontexts
2. Validierung von `instanceId` und Zielkontext
3. Rollenauflösung und Permission-Aggregation
4. Scope-Matching und Denial/Allow-Bewertung
5. Antwort mit `allowed`, `reason`, optionaler Diagnosemetadaten

## Query-Strategie

- Voraggregierte Abfragen pro Benutzer/Instanz statt N+1-Pattern
- Strikte Filterung auf `instanceId` als Primärbedingung
- Explizite Testfälle für organisationsübergreifende Denials

## Operative Observability

- SDK Logger ist verpflichtend für die Authorize-Engine (`component: iam-authorize`)
- Denials werden auf `warn`-Level mit `reason`-Code protokolliert; Allows auf `debug`
- `request_id` und `trace_id` werden über beide Endpunkte durchgängig propagiert
- OTEL-Metriken für `authorize`-Latenz (mindestens P95/P99) werden kontinuierlich erhoben

## Architekturartefakte

- OpenAPI-Definition für `POST /iam/authorize` und `GET /iam/me/permissions`
- ADR-012: Permission-Kompositionsmodell für RBAC v1 (additives OR-Modell)
- ADR-013: RBAC+ABAC-Hybrid-Modell (RBAC in Child C, ABAC-Erweiterung in Child D)

## Alternativen und Abwägung

- Direkte Modul-DB-Abfragen: verworfen wegen inkonsistenter Entscheidungen
- Frühzeitige ABAC-Integration: verworfen, um Komplexität in Child C zu begrenzen

## Verifikation

- Contract-Tests für beide Endpunkte
- Denial-/Allow-Testmatrix für Instanz- und Organisationsgrenzen
- P95-Baseline für `authorize` dokumentiert

## arc42-Referenzen (final)

- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/09-architecture-decisions.md`
- `docs/architecture/10-quality-requirements.md`
