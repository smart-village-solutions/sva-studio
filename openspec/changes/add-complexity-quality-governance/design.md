## Context

Zentrale Module wie IAM-Server, Routing und Security tragen überproportional zu Sicherheits-, Stabilitäts- und Änderungsrisiken bei. Bestehende Qualitätssicherung deckt funktionale Korrektheit und Coverage ab, aber nicht systematisch die strukturelle Komplexität dieser Hotspots.

Die neue Governance muss in das bestehende Nx-/OpenSpec-/CI-Modell passen, maschinenlesbare Reports erzeugen und für Reviewer nachvollziehbar bleiben. Historische Lasten dürfen sichtbar gemacht werden, ohne den Rollout unnötig zu blockieren.

## Goals / Non-Goals

- Goals:
  - Zentrale und kritische Module explizit klassifizieren
  - Strukturelle Komplexität automatisiert messen und versioniert bewerten
  - Überschreitungen in verbindliche Refactoring-Folgearbeit überführen
  - Coverage-Regeln für kritische Module an Komplexität koppeln, ohne Floors zu senken
- Non-Goals:
  - Kein pauschales Rewrite historisch komplexer Bereiche in einem Schritt
  - Keine rein manuelle Review-Checkliste ohne maschinenlesbare Metriken
  - Keine Entkopplung von bestehender Coverage-Governance

## Decisions

- Decision: Modulregister für zentrale und kritische Bereiche
  - Rationale: Die Governance braucht einen klaren Scope statt diffuser Heuristiken. Beispiele sind IAM-Server, Routing und Security-nahe Pfade.

- Decision: Kleine Menge verbindlicher Kernmetriken
  - Rationale: Dateigröße, Funktionslänge, Cyclomatic Complexity und öffentliche Exports sind breit verständlich, automatisierbar und korrelieren gut mit Wartungsrisiken.

- Decision: Versionierte Schwellwerte mit Baseline und Review-Historie
  - Rationale: Grenzwerte müssen nachvollziehbar, auditierbar und änderbar sein, ohne stillschweigend zu driften.

- Decision: Ticket-Pflicht statt stiller Warnungen
  - Rationale: Bei kritischen Modulen reicht Sichtbarkeit allein nicht aus. Jede Überschreitung braucht eine explizite Folgeentscheidung und Nachverfolgung.

- Decision: Coverage-Ratcheting entlang der Komplexität
  - Rationale: Wenn Komplexität steigt, wächst das Regressionsrisiko. Die Antwort darf daher nicht sein, Coverage-Floors abzusenken, sondern sie stabil zu halten oder zielgerichtet zu verschärfen.

## Policy Shape

- Modulregister:
  - Modul-ID, Pfad-Globs, Klasse (`zentral` oder `kritisch`), Owner, Review-Zyklus
- Metrik-Policy:
  - Grenzwerte pro Metrik und Modulklasse
  - optional strengere Overrides pro Modul
  - Baseline-/Trend-Informationen
- Coverage-Policy:
  - Mindest-Floors für kritische Module
  - optional feinere Gates pro Pfad oder Datei für Hotspots

## Risks / Trade-offs

- Risiko: Zu aggressive Grenzwerte blockieren bestehende Arbeit
  - Mitigation: Baseline-Rollout, priorisierte Hotspots, Ticket-Pflicht als kontrollierte Übergangsform

- Risiko: Metriken werden formal erfüllt, aber schlechte Strukturen bleiben bestehen
  - Mitigation: Reports müssen Hotspots konkret benennen; Review bleibt ergänzend erforderlich

- Risiko: Ticket-Pflicht wird administrativ statt technisch gelebt
  - Mitigation: CI-Output und PR-Template müssen Ticket-Referenzen explizit verlangen

## Rollout

1. Modulregister und initiale Policy für zentrale/kritische Bereiche definieren.
2. Reports zunächst transparent in PRs und lokal verfügbar machen.
3. Ticket-Pflicht für neue Überschreitungen aktivieren.
4. Coverage-Floors für kritische Module an Komplexitätssignale koppeln und schrittweise verfeinern.

## Open Questions

- Soll die Ticket-Erzeugung direkt automatisiert werden oder reicht initial ein verpflichtender PR-Nachweis?
- Welche Modulklasse gilt für geteilte Infrastrukturpakete mit Security-Relevanz?
- Welche Altlasten werden sofort gegatet und welche zunächst nur mit Baseline sichtbar gemacht?
