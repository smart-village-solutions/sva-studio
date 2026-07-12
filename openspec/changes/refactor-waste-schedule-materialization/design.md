## Kontext

Der bestehende Mainserver-Sync berechnet aus Touren, Standortzuordnungen, Tour- und globalen Verschiebungen sowie Feiertagsregeln bereits konkrete Abholtermine. Diese Berechnung ist deterministisch, auf das laufende und folgende Jahr begrenzt und vor den Mainserver-Transport geschaltet. Ihr Ergebnis ist bisher flüchtig.

## Ziele und Nicht-Ziele

- Ziele
  - Einen reproduzierbaren, instanzbezogenen Snapshot der berechneten Tourtermine persistieren.
  - Den Mainserver-Sync ausschließlich aus einem unmittelbar zuvor erfolgreich aktualisierten Snapshot versorgen.
  - Materialisierungsstand und -umfang betrieblich sichtbar machen.
- Nicht-Ziele
  - Kein neues Regelmodell und keine Migration bestehender Tour-, globaler oder Feiertagsverschiebungen.
  - Keine Änderung der vorhandenen Berechnungssemantik oder des Jahrfensters.
  - Keine automatische Nachrechnung über das Folgejahr hinaus.

## Entscheidungen

- Entscheidung: Die vorhandenen Shift- und Holiday-Records bleiben die einzige Regelquelle.
  - Die Materialisierung übersetzt sie wie bisher zur Laufzeit in fachliche Regeln.
- Entscheidung: Der Snapshot wird pro Instanz und Jahrfenster idempotent ersetzt.
  - Ein erfolgreicher Materialisierungslauf hinterlässt keine Mischung aus alten und neuen Terminen.
- Entscheidung: Der Sync liest erst nach erfolgreicher Snapshot-Aktualisierung aus der persistierten Tabelle.
  - Ein Persistenzfehler verhindert den Transport und damit einen nicht reproduzierbaren Sync.

## Risiken und Gegenmaßnahmen

- Risiko: Ein Schema- oder Backfill-Fehler erzeugt einen unvollständigen Snapshot.
  - Gegenmaßnahme: additive Migration, atomare Ersetzung, Test für leere und fehlerhafte Persistenz sowie kein Transport bei Fehlern.
- Risiko: Snapshot und Regelquellen driften zwischen zwei Läufen.
  - Gegenmaßnahme: Jeder Sync materialisiert sein Fenster unmittelbar vor dem Lesen neu und protokolliert den Zeitpunkt.

## Migrationsplan

1. Additive Snapshot-Tabelle und Repository einführen.
2. Bestehende Berechnung in die idempotente Snapshot-Ersetzung einhängen.
3. Sync auf das Lesen des Snapshots umstellen.
4. Schema-Snapshot, Betriebsdokumentation und Tests aktualisieren.

## Offene Fragen

- Welcher fachliche Schlüssel verhindert Duplikate bei mehreren Quellen für denselben Abholtermin?
- Wie lange sollen ältere Snapshots nach einer erfolgreichen Ersetzung für Diagnosezwecke aufbewahrt werden?
