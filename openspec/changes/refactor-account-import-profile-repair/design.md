## Context

Der Import lädt einen ausschließlich über `(instanceId, keycloakSubject)` gebundenen lokalen Profil-Seed. Fehlende Keycloak-Felder können daraus und für E-Mail zuletzt aus einem syntaktisch gültigen Username ergänzt werden. Seiteneffekte und Berichtsbildung liegen derzeit gemeinsam mit dieser Fallback-Entscheidung in komplexen Funktionen.

## Goals / Non-Goals

- Goals: bestehende Prioritäten und Grenzen explizit machen, reine Entscheidungslogik isolieren, Seiteneffekt-Reihenfolge und Fehlerpropagation erhalten, Fallow-Hotspots beseitigen.
- Non-Goals: neue Fallbacks, Änderung des Keycloak- oder Importformats, Bulk-Reprovision, Datenbankschema, zusätzliche Provider-/Service-Abstraktion.

## Decisions

- Decision: Eine interne reine Funktion erzeugt aus Quellprofil und lokalem Seed einen Reparaturplan samt finalem Profil und Reparaturflags.
- Decision: Der aufrufende Handler bleibt alleiniger Owner von Seed-Lookup, Keycloak-Mutation und Logging.
- Decision: Der Importlauf wird durch kleine interne Funktionen für Einzelobjektverarbeitung und Reportaufbau entlastet; Savepoint- und Fehlerreihenfolge bleiben unverändert.
- Alternatives considered: Nur zusätzliche Tests senken den coverageabhängigen CRAP-Anteil, lassen aber die strukturelle Komplexität und gekoppelte Ownership bestehen. Eine neue Service-Abstraktion hätte ohne zweiten Konsumenten zusätzliche Ownership erzeugt.

## Risks / Trade-offs

- Verdeckte Fallback- oder Normalisierungsänderung -> Characterization-Matrix fixiert Quellwert-, Seed- und Username-Priorität einschließlich Blank- und Konfliktfällen.
- Fremde Identität oder Instanz wird mutiert -> Lookup-, Update- und Persistenzargumente werden gemeinsam auf exakte Instanz-/Subject-Bindung geprüft.
- Fehler wird als Erfolg berichtet -> Provider-Fehler-, Savepoint-, Manual-Review- und Reporttests sichern fail-closed Verhalten.

## Migration Plan

Keine Daten- oder API-Migration. Die Änderung ist ein interner verhaltensneutraler Refactor und kann durch Rücknahme des Refactor-Commits vollständig zurückgerollt werden.

## Open Questions

Keine.
