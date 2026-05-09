# Design: Gruppenzuweisung als bevorzugter Standard beim Nutzer-Anlegen

## Ziel
Beim Anlegen eines Benutzers soll die initiale Gruppenzuweisung der bevorzugte Standard werden. Die direkte Rollenwahl bleibt für Sonderfälle erhalten, aber nicht mehr als primärer erster Schritt.

## Empfohlener Ansatz
Die Create-UI zeigt zuerst Gruppen. Rollen werden in einen optionalen erweiterten Bereich verschoben. Der Create-API-Vertrag wird um optionale `groupIds` ergänzt, damit der fachlich bevorzugte Flow nicht erst nachgelagert über die Bearbeitungsseite erfolgen muss.

## Daten- und Verhaltensmodell
- Gruppen und direkte Rollen dürfen gemeinsam übergeben werden.
- Gruppen liefern gebündelte Rollen über bestehende IAM-Mechanik.
- Direkte Rollen bleiben additive Sonderfälle.
- Leere Gruppenwahl blockiert die Erstellung nicht, solange ein Sonderfall bewusst nur mit direkter Rolle modelliert wird.

## Auswirkungen
- Die UI wird verständlicher für den bevorzugten Betriebsmodus.
- Der Backend-Create-Pfad wird an den bereits vorhandenen Update-Pfad angenähert.
- Bestehende Admin-Workflows bleiben kompatibel, statt hart auf Gruppen-only umgestellt zu werden.
