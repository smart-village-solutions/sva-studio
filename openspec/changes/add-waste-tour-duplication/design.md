## Context
Das Waste-Management nutzt bereits einen tabellenbasierten Tourenbereich mit bestehendem Create-/Edit-Flow. Neu benötigt wird eine Duplizierungsfunktion, die ohne Spezialseite in denselben Create-Flow führt und nach erfolgreichem Speichern serverseitig die abhängigen Beziehungen der Quell-Tour übernimmt.

## Goals
- Vorbelegter Tour-Create-Flow aus der Tabellenzeile heraus
- Vollständige serverseitige Kopie von Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen
- Keine Teilerfolge bei der fachlichen Duplizierung

## Non-Goals
- Kein eigener `duplicate-tour`-Endpoint
- Keine Änderung bestehender Edit-Flows außerhalb des optionalen Duplizierungs-Kontexts
- Keine Duplizierung globaler Date-Shifts

## Decisions
- Die UI führt den Duplizierungs-Kontext über `duplicateFromTourId` in Search-Params und Submit-Payload.
- Die neue Tour wird regulär über den bestehenden Create-Handler angelegt.
- Die Kopie von Zuordnungen und tourbezogenen Datumsverschiebungen läuft ausschließlich serverseitig nach erfolgreichem Create.
- Die Tabellenaktion wird nur angezeigt, wenn sowohl Tour- als auch Scheduling-Verwaltungsrechte vorhanden sind.

## Risks / Trade-offs
- Der Create-Handler bekommt zusätzliche fachliche Verantwortung; das wird durch klar getrennte Loader- und Repository-Helfer begrenzt.
- Fehler bei der nachgelagerten Kopie dürfen nicht als stiller Teilerfolg enden; der Server muss die Gesamtoperation als Duplizierung behandeln und entsprechend fehlschlagen.

## Validation
- Failing Tests zuerst für Search-Params, Navigation, Form-Hinweis, Submit-Payload und serverseitige Kopierlogik
- Danach gezielte Nx-Unit-Runs für `plugin-waste-management`, `auth-runtime` und `data-repositories`
