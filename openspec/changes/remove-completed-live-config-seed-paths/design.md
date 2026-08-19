## Context

H4 und H5 waren bewusst eng begrenzte Einmalverträge für bereits laufende Services ohne `sva.config.revision`. Nach dem erfolgreichen Production-Handshake und dem regulären Production-Rollout ist dieser Zustand abgeschlossen. Der Rückbau muss deploymentfähig bleiben und historische Evidence-v2-Artefakte weiterhin lesbar halten.

## Goals / Non-Goals

- Goals:
  - Keine Dispatch- oder `workflow_call`-Eingabe kann einen Seed-Pfad auswählen.
  - Kein aktiver Workflow-Schritt kann Seed-Verifier oder Seed-Overlays starten.
  - Normale Standard- und Recovery-Promotes behalten ihre bisherigen blockierenden Gates.
  - Neue Evidence-v2-Artefakte enthalten `seedPreparation: null` und `seedAuthorization: null`.
- Non-Goals:
  - Seed-Dateien, Parser, Fehlertypen oder Controller-Kopien bereits in dieser Stufe zu löschen.
  - Evidence Schema v3 einzuführen.
  - Dual-Source-Checkout, Controller-Aufbau, Secrets, Environment-Variablen oder Runtime-Konfiguration zu ändern.

## Decisions

- Decision: Der aktive Workflow verliert den gesamten Seed-Zustandsautomaten in einem zusammenhängenden Commit. Es bleibt kein versteckter oder intern aufrufbarer Modus zurück.
- Decision: Die Evidence-Umgebungswerte werden leer gesetzt, sodass der bestehende Normalisierer die beiden v2-Felder deterministisch als `null` schreibt. Seed-spezifische Gate-Namen bleiben bis zum zweiten Code-PR im Schema und werden für neue Runs als `skipped` normalisiert.
- Decision: Die Seed-Dateien und ihre Controller-Kopien bleiben zunächst unverändert. Das begrenzt den ersten Rollout auf Erreichbarkeit und erlaubt einen separaten Production-Nachweis vor dem physischen Löschen.
- Decision: Der allgemeine Config-Revision-Vertrag bleibt unverändert fail-closed. Ein fehlendes oder ungültiges Label führt nicht zu einem Ersatzpfad, sondern zu einem neuen geprüften Recovery-Change.

## Alternatives considered

- Sofortige Komplettlöschung: reduziert schneller Dateien, koppelt aber Verhaltens- und Strukturabbau in einen größeren Rollout ohne Zwischenbeweis.
- Eingaben behalten und nur validierungsseitig ablehnen: lässt einen irreführenden Operatorvertrag und unnötige Zustandszweige sichtbar.
- Evidence Schema v3: wäre für zwei dauerhaft `null` bleibende Felder eine unnötige Migration und bricht historische Consumer.

## Risks / Trade-offs

- Versehentliches Entfernen eines regulären Gates wird durch Workflow-Strukturtests und den vollständigen Dev-Staging-Production-Nachweis begrenzt.
- Unerreichbarer Seed-Code bleibt kurzfristig als Ownership bestehen; er wird erst nach erfolgreichem Production-Nachweis in einem getrennten PR gelöscht.
- Historische v2-Artefakte können weiterhin nicht-null Seed-Inhalte enthalten; Parser akzeptieren sie, aber kein Workflowpfad kann daraus Autorisierung ableiten.

## Migration Plan

1. Seed-Einstiege und aktive Schritte entfernen, Evidence v2 null halten und lokal validieren.
2. PR auf grünem Head mergen und denselben Digest mit `assert-none` über Dev, Staging und Production nachweisen.
3. Erst danach die unerreichbare Implementierung in einem separaten PR entfernen und denselben Rolloutnachweis wiederholen.

Rollback vor Mutation ist der Revert des Workflow-PRs. Nach einer Mutation gilt ausschließlich das in der Promote-Evidenz dokumentierte Digest-/Config-Revision-Paar.

## Open Questions

- Keine. Umfang und zweistufige Reihenfolge sind freigegeben.
