## Context

Die zentrale IAM-Engine kombiniert eine Allow-only-RBAC-Basis mit kontextuellen ABAC-Einschränkungen. `evaluateAbacRules` wertet derzeit alle Regelarten in einer Funktion aus. Die Reihenfolge ist fachlich relevant: fehlender Pflichtkontext und Restriktionen müssen fail-closed entscheiden, Geo-Unit-Regeln haben Vorrang vor dem Legacy-Geo-Scope-Fallback, Zeitfenster werden inklusive Über-Mitternacht-Fenstern geprüft und Force-Deny bleibt die letzte explizite Konfliktregel innerhalb eines Grants.

## Goals / Non-Goals

- Goals:
  - die bestehende Entscheidungsreihenfolge als lesbare, reine Evaluator-Pipeline ausdrücken,
  - Cyclomatic und Cognitive Complexity des bisherigen Hotspots messbar senken,
  - Allow/Deny, Reason, Provenance und öffentliche API vollständig erhalten.
- Non-Goals:
  - neue ABAC-Regeln, Actions oder Permission-Modelle,
  - Änderungen an Datenbank, HTTP, Cache oder DataProvider-Verträgen,
  - neue Exports oder ein zweiter Authorize-Einstiegspunkt.

## Decisions

- Decision: Jede fachliche Regelgruppe liefert entweder keine Entscheidung oder ein vollständig typisiertes bestehendes ABAC-Ergebnis. Die Orchestrierung wertet diese Bausteine in der bisherigen Reihenfolge aus und gibt die erste Entscheidung zurück.
- Decision: Parsing und Ableitung der Geo-/Zeit-/Kontextwerte erfolgen einmalig in einem internen typisierten Regelkontext.
- Decision: Restriktionen bleiben grantbezogen. Mehrere passende Allow-Grants behalten die bestehende Semantik, nach der ein anderer zulässiger Grant den Zugriff erlauben kann.
- Decision: Interne Module erhalten keine Root-Exports; `evaluateAuthorizeDecision` bleibt die öffentliche Package-Grenze.
- Alternatives considered:
  - Nur lokale Funktionen in der bestehenden Datei: verworfen, wenn dadurch der Hotspot weiterhin eine schwer reviewbare Verantwortungseinheit bleibt.
  - Konfigurierbare Regelregistry: verworfen, weil sie für die feste bestehende Reihenfolge spekulative Flexibilität und zusätzliche Ownership erzeugt.

## Risks / Trade-offs

- Eine versehentlich veränderte Reihenfolge könnte Denial-Reasons oder Allow-Ergebnisse ändern. Mitigation: Characterization-Tests werden vor der Extraktion ergänzt und prüfen kollidierende Regeln sowie Provenance.
- Zu feine Module könnten die Navigation erschweren. Mitigation: Ein internes ABAC-Modul enthält die fachlichen Evaluatoren; die von Engine und ABAC gemeinsam benötigte Provenance-Ableitung bleibt ein eigener kleiner interner Baustein.
- Systemzeit bleibt bei aktivem Zeitfenster ohne explizite `currentTime` nicht deterministisch. Mitigation: Der bestehende Vertrag wird nicht verändert; Characterization-Tests verwenden explizite Zeiten.

## Migration Plan

1. Bestehende Regelprioritäten und Kombinationen durch Tests fixieren.
2. Internen typisierten Regelkontext und reine Evaluatoren extrahieren.
3. Unit-, Type-, Lint-, Runtime-, Complexity-, OpenSpec- und Fallow-Gates ausführen.
4. Bei jeder semantischen Abweichung die Extraktion zurücknehmen; es gibt keinen Daten- oder Runtime-Migrationsschritt.

## Open Questions

- Keine. Der Change verändert ausschließlich die interne Struktur des bestehenden Vertrags.
