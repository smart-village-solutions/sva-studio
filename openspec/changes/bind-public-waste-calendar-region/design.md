## Context

Die öffentliche Web-App führt die veränderbare Standortauswahl derzeit als einen gemeinsamen Zustand. Eine URL-seitig vorgegebene Region ist dagegen Seitenkontext: Sie darf weder durch ein Cookie aus einer anderen Region noch durch „Adresse ändern“ oder die Bearbeitung eines früheren Auswahlschritts entfernt werden.

## Goals / Non-Goals

- Goals: URL-Region während der geöffneten Seite unveränderlich binden, alle Folgeabfragen auf sie begrenzen und ungültige Vorgaben fail-closed behandeln.
- Non-Goals: neue Standortdatenquelle, neuer API-Endpunkt, Persistenz der URL-Vorgabe oder Änderung des Auswahlflusses ohne `regionId`.

## Decisions

- Die Web-App liest `regionId` einmal aus `window.location.search`, validiert das UUID-Format und führt sie getrennt von Ort, Straße und Hausnummer.
- Jede initiale oder zurückgesetzte Auswahl beginnt bei gebundener Region mit `{ regionId }`. Der sichtbare Auswahlpfad enthält die Region nicht.
- Ein gespeicherter Standort darf nur innerhalb der gebundenen Region wiederhergestellt werden; seine eigene Region überschreibt die URL-Vorgabe nicht.
- Das bestehende Selection-Repository prüft eine explizite Region gegen die aktiven auswählbaren Regionen. Eine unbekannte Region liefert keine Optionen und kann daher nicht auf regionslose Daten zurückfallen.
- Der bestehende finale Selection-Vertrag bleibt führend für Kalender, PDF, iCal und E-Mail-Erinnerungen.

## Risks / Trade-offs

- Regionslose Waste-Zuordnungen dürfen bei einer bekannten Region weiterhin wie bisher als gemeinsam gültige Zuordnungen erscheinen. Eine unbekannte Region wird davor ausdrücklich abgewiesen.
- Die Bindung gilt für die Lebensdauer der geladenen Seite. Eine Navigation auf eine andere URL lädt bewusst einen neuen Kontext.

## Test Strategy

- Route-Unit-Tests für gültige, formal ungültige und unbekannte URL-Regionen, Cookie-Konflikte sowie wiederholtes Zurücksetzen.
- Repository-Unit-Test für die fail-closed Behandlung unbekannter Regionen.
- E2E-Test für Start bei Ort, vollständige Auswahl, „Adresse ändern“ und erneute regionsgebundene Auswahl einschließlich Exportvertrag.
