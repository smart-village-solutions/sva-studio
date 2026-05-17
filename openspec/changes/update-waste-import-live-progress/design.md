## Context
Der Waste-Spezialimport `waste-management.ortsbezogene-tourtermine` parst die CSV-Datei bereits vollständig, kennt damit `validRowCount` und verarbeitet die validen Zeilen im Persistenzlauf nacheinander. Gleichzeitig publiziert der generische Plugin-Job-Runner heute nur einen groben Zweischritt-Fortschritt (`resolve-operation`, `complete-operation`), sodass die UI keine belastbare Prozentanzeige zeigen kann.

## Goals / Non-Goals
- Goals:
  - Echten Laufzeitfortschritt für laufende Waste-Importe mit Prozentwert und Zeilenbezug bereitstellen
  - Bestehenden generischen Job-Vertrag weiterverwenden
  - Datenbank- und Eventlast durch blockweise Fortschrittsmeldungen begrenzen
- Non-Goals:
  - Kein neuer Jobtyp und keine neue Route
  - Kein generischer Vollausbau aller Plugin-Importe auf zeilenfeinen Fortschritt
  - Keine Änderung an der Historienansicht abgeschlossener Jobs

## Decisions
- Decision: Fortschrittsdaten werden weiterhin über `StudioJobProgress` transportiert.
  - Alternatives considered:
    - Separates Waste-spezifisches Progress-Dokument: verworfen, weil es den generischen Job-Vertrag umgeht
    - Nur Phasen ohne Zeilenzahlen: verworfen, weil die CSV-Importe eine konkrete Gesamtmenge kennen

- Decision: Zeilenfeiner Fortschritt wird über `progress.details` transportiert.
  - Alternatives considered:
    - Neue Top-Level-Felder im Job-Vertrag: verworfen, weil für den ersten Ausbau `details` ausreicht
    - Ableitung nur aus technischen Events: verworfen, weil die UI den aktuellen Stand direkt aus dem Jobdetail lesen soll

- Decision: Fortschritt wird blockweise berichtet, standardmäßig alle 25 verarbeiteten Zeilen und am Ende jedes fachlichen Phasenwechsels.
  - Alternatives considered:
    - Bericht nach jeder Zeile: verworfen wegen unnötiger Persistenz- und Eventlast
    - Nur am Anfang und Ende: verworfen, weil daraus kein echter Ladebalken entsteht

## Risks / Trade-offs
- Höhere Polling-Frequenz für aktive Jobs erhöht die Last leicht.
  - Mitigation: Nur aktive Imports häufiger pollen; Historie bleibt unverändert.
- Blockweiser Fortschritt ist nicht auf jede einzelne Zeile exakt sichtbar.
  - Mitigation: Prozentwert und `verarbeitete Zeilen / Gesamtzeilen` bleiben dennoch fachlich glaubwürdig und stabil.

## Migration Plan
1. Progress-Kontext bis in den Waste-Import durchreichen
2. CSV-Spezialimport in fachliche Phasen und Fortschrittsblöcke schneiden
3. UI von grobem Zweischritt-Fortschritt auf echte Prozent- und Zeilendetails umstellen
4. Tests für Progress-Details, Polling und UI ergänzen

## Open Questions
- Keine fachlichen offenen Fragen; Batch-Größe bleibt eine technische Default-Entscheidung und kann bei Bedarf später konfigurierbar gemacht werden.
