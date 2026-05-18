# Change: Echte Fortschrittsanzeige für laufende Waste-Importe

## Why
Die aktuelle Waste-Importanzeige kann nur einen groben technischen Fortschritt aus `queued/running/succeeded` und einem Zweischritt-Progress ableiten. Für den CSV-Spezialimport liegen jedoch bereits valide Zeilen, fachliche Phasen und konkrete Importschritte vor, sodass Benutzer einen nachvollziehbaren Laufzeitfortschritt mit Prozentwert und Zeilenbezug erwarten dürfen.

## What Changes
- Waste-Importe veröffentlichen für den laufenden Commit-Pfad strukturierte Laufzeitfortschritte mit Phasen, verarbeiteten Zeilen und Gesamtzeilenanzahl
- Die generische Plugin-Operations-Plattform präzisiert ihren Progress-Vertrag für strukturierte Kurzsicht und Detailansichten
- Die Waste-UI zeigt für den aktuell laufenden Import einen echten Fortschrittsbalken mit Prozentwert, Phasentext und Zeilenfortschritt
- Fortschrittsmeldungen werden blockweise statt pro Zeile persistiert, um Job-Historie und Datenbanklast kontrolliert zu halten

## Impact
- Affected specs: `waste-management`, `plugin-operations-platform`
- Affected code: `packages/plugin-waste-management`, `apps/sva-studio-react`, `packages/auth-runtime`, `packages/core`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
