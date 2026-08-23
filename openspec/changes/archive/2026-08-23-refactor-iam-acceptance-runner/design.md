## Context

`run-iam-acceptance.ts` ist ein operativer CLI-Runner mit realen Keycloak-, PostgreSQL-, HTTP- und Browser-Abhängigkeiten. Seine Reihenfolge ist fachlich relevant: Preflight und Reset müssen vor mutierenden Nachweisen liegen; Berichte und Exitcodes müssen auch bei frühen Fehlern fail-closed bleiben.

## Goals / Non-Goals

- Goals: kleine typisierte Prüfschritte, sichtbare Orchestrierungsreihenfolge, unveränderte Fehler- und Berichtsemantik, testbare Prozessgrenze.
- Non-Goals: neue Acceptance-Fälle, echte Testumgebungsläufe, Secret- oder Deployment-Änderungen, generische Workflow-/Rule-Engine.

## Decisions

- Der CLI-Einstieg bleibt dünn und ruft explizit benannte Phasen in der bestehenden Reihenfolge auf.
- Browser-, HTTP- und Datenbankports bleiben strukturell typisiert; es werden keine `any`-Fallbacks oder spekulativen Interfaces eingeführt.
- Schrittaufzeichnung und `failStep` bleiben eine laufbezogene Zustandsgrenze. Jeder Lauf erhält eine eigene Record-Liste, damit Tests und wiederholte Aufrufe keinen globalen Zustand teilen.
- Frühfehler schreiben weiterhin einen Fallback-Bericht und setzen Exitcode 1. Secretwerte werden weder in Logs noch Berichte aufgenommen.
- Die vorhandenen direkten Workspace-Imports und `createRequire`-Auflösungen bleiben unverändert, weil Dependency- und Runtime-Architektur nicht Teil dieses Refactors sind.

## Risks / Trade-offs

- Versehentliche Umordnung kann Setup oder Cleanup verändern. Characterization und eine explizite Phasenliste sichern die Reihenfolge.
- Fehler können bei Modulgrenzen doppelt klassifiziert werden. Klassifizierte `acceptance_*`-Fehler bleiben autoritativ; nur unbekannte Fehler erhalten `acceptance_runner_unexpected_error`.
- Ein realer Acceptance-Lauf ist ohne geschützte Zugangsdaten nicht möglich. Lokale Tests verwenden ausschließlich fehlende oder künstliche Konfiguration und führen keine Umgebungsoperationen aus.

## Migration Plan

1. CLI-, Exitcode-, Redaction- und Pflichtprüfungs-Characterization ergänzen.
2. Laufkontext und reine Helper extrahieren.
3. Preflight/Login-, Organisations-/Membership- und UI-Phasen extrahieren.
4. Runner als explizite Orchestrierung erhalten und alle Gates ausführen.

## Open Questions

- Keine. Der fachliche Acceptance-Vertrag bleibt unverändert.
