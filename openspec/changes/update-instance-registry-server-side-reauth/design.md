## Context

Die bestehende Sicherheitsanforderung in der Instanzverwaltung fordert frische Re-Authentisierung fuer kritische Mutationen, aber der aktuelle Guard akzeptiert einen klientseitig gesetzten Header als hinreichenden Nachweis. Dadurch existiert zwar ein nomineller Reauth-Schritt, aber kein serverseitig belastbarer Beweis, dass die Session tatsaechlich kuerzlich erneut bestaetigt wurde.

Gleichzeitig soll die Härtung den laufenden Delivery- und Bugfix-Flow nicht uebermaessig behindern. Deshalb wird der Change auf wenige hochsensitive Root-Host-Control-Plane-Mutationen begrenzt und fuer lokale Nicht-Produktiv-Profile explizit modelliert.

## Goals / Non-Goals

- Goals:
  - Kritische Instanz- und Keycloak-Mutationen verlangen einen serverseitig gebundenen Fresh-Reauth-Nachweis.
  - Klientseitige Signale wie Header oder Query-Parameter sind kein Sicherheitsbeweis mehr.
  - Der Scope bleibt klein und auf wenige hochsensitive Mutationen begrenzt.
  - Lokale Entwicklungsprofile bleiben mit einem expliziten Nicht-Produktiv-Verhalten arbeitsfaehig.
- Non-Goals:
  - Kein generischer Reauth-Rollout fuer alle IAM-Mutationen.
  - Kein neuer allgemeiner Benutzer-Workflow fuer Forced Reauth ausserhalb des Instance-Registry-Pfads.
  - Keine gleichzeitige Härtung der Forwarded-Header-Trust-Logik in diesem Change.

## Decisions

- Decision: Fresh-Reauth wird an serverseitige Session-Evidenz gebunden.
  - Der Guard akzeptiert nur Session-Zustand, der vom Server selbst gesetzt oder aus bestehender Reauth-Session-Logik abgeleitet wurde.
- Decision: Kritischer Scope bleibt klein.
  - Pflichtig sind nur Root-Host-Control-Plane-Mutationen mit hohem Schadenspotenzial, insbesondere Keycloak-Provisioning, Reconcile, Modul-Bootstrap und Status-/Strukturmutationen in der zentralen Instanzverwaltung.
- Decision: Klientseitige Bestaetigungen werden als Sicherheitsnachweis verboten.
  - Request-Header, Query-Parameter oder UI-Lokalzustand duerfen den Guard nicht passieren lassen.
- Decision: Nicht-Produktiv-Verhalten wird explizit statt implizit modelliert.
  - Lokale Dev-/Mock-Auth-Profile erhalten entweder einen serverseitigen Dev-Nachweis oder einen bewusst dokumentierten Bypass, der ausserhalb dieser Profile nicht verfuegbar ist.

## Risks / Trade-offs

- Eine serverseitige Fresh-Reauth-Bindung kann bestehende Admin-Flows und Tests brechen, die bisher nur den Header gesetzt haben.
  - Mitigation: Guard nur auf wenige kritische Mutationen anwenden und Tests gezielt migrieren.
- Ein zu kurzes Freshness-Fenster kann die Admin-UX verschlechtern.
  - Mitigation: konfigurierbares, aber eng begrenztes Zeitfenster mit konservativem Default.
- Ein zu grosszuegiger Dev-Bypass kann Sicherheitslogik wieder verwässern.
  - Mitigation: explizite Bindung an lokale Runtime-Profile und keine Aktivierung in prodnahen Profilen.

## Migration Plan

1. Capability-Vertraege fuer `iam-core` und `instance-provisioning` praezisieren.
2. Serverseitige Reauth-Evidenz im Auth-/Session-Kontext identifizieren oder minimal erweitern.
3. Kritische Instance-Registry-Guards auf den serverseitigen Nachweis umstellen.
4. Tests fuer gueltige, fehlende und veraltete Reauth-Evidenz ergaenzen.
5. Nicht-Produktiv-Verhalten fuer lokale Entwicklungsprofile dokumentieren und absichern.

## Open Questions

- Welches bestehende Session-Feld eignet sich als serverseitige Fresh-Reauth-Evidenz am besten, ohne einen grossen Auth-Flow-Umbau zu erzwingen?
- Welche konkrete Liste von Instance-Registry-Mutationen wird im ersten Schritt als reauth-pflichtig behandelt?
