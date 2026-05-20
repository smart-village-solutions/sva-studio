## Context
Die bestehende Benutzererstellung ist auf direkte Rollenzuweisung optimiert. Gleichzeitig existiert im System bereits ein Gruppenmodell mit gruppengebündelten Rollen sowie eine Bearbeitungslogik für Gruppenmitgliedschaften im User-Update-Pfad. Der Create-Pfad nutzt diese Capability bisher nicht.

## Decision
Die Benutzererstellung erhält eine primäre Gruppenauswahl. Direkte Rollen bleiben erhalten, werden aber in einen optionalen erweiterten Bereich verschoben. Der Create-API-Vertrag wird um optionale `groupIds` erweitert. Gruppen und Rollen dürfen gemeinsam übergeben werden.

## Consequences
- Der bevorzugte Admin-Flow orientiert sich an fachlichen Gruppen statt an Einzelrollen.
- Bestehende Sonderfälle mit direkter Rollenzuweisung bleiben kompatibel.
- Der Create-Flow nähert sich dem bestehenden Update-Modell an, statt ein separates Zuordnungsmodell einzuführen.
- Die effektive Rechtevergabe bleibt nachvollziehbar: Gruppen liefern gebündelte Rollen, direkte Rollen bleiben additive Sonderfälle.
