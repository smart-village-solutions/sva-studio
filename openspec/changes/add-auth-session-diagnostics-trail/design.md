## Context

Der bisherige Auth-Pfad unterscheidet im UI kaum zwischen echter Session-Ablaufgrenze, fehlgeschlagenem Silent-SSO, Session-Store-Ausfall oder fachlicher Reauth-Invalidierung. Serverlogs und Browserzustand lassen sich nachträglich nur begrenzt korrelieren.

## Goals / Non-Goals

- Goals:
  - strukturierte, sichere Auth-Diagnostik auf Server- und Browserseite
  - gemeinsame Korrelation über `requestId` und `authFlowId`
  - reproduzierbarer Vorlauf für `session-expired`-Fälle
- Non-Goals:
  - keine unmittelbare Retry-/Timeout-Härtung
  - keine persistente produktive Debug-UI
  - keine Speicherung sensibler Tokens oder PII im Browser

## Decisions

- `/auth/me` nutzt denselben Fehlervertrag wie andere IAM-Endpunkte.
- Auth-spezifische Ursachen werden über `reason_code` innerhalb der bestehenden Runtime-Diagnostik modelliert, nicht als separates Fehlermodell.
- Browserseitig wird ein Ringpuffer in `sessionStorage` verwendet, der nur in Dev-/Diagnosemodi aktiv ist.
- Korrelation erfolgt additiv:
  - `requestId` für Serverantworten
  - `authFlowId` für clientseitige Ablaufketten

## Risks / Trade-offs

- Der Browser-Trail ist absichtlich lokal und flüchtig; ohne Dev-/Diagnosemodus bleibt nur die Servertelemetrie.
- Erfolgreiche Silent-Recovery-Fälle erzeugen mehr Diagnoseereignisse; diese Mehrmenge ist für Ursachenverständnis bewusst akzeptiert.

## Migration Plan

1. Core-Diagnostik erweitern.
2. Auth-Runtime auf strukturierte Fehlergründe umstellen.
3. Browser-Trail und Session-Expired-Anzeige ausrollen.
4. Folgearbeit für Retry-/Timeout-Härtung erst nach Evidenz aus den neuen Signalen.
