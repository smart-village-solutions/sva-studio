# Change: Fehlende Waste-Postleitzahlen automatisch ergänzen

## Why

Produktive Waste-Instanzen können viele Abholorte besitzen, deren zugeordnete Städte noch keine Postleitzahl tragen. Die manuelle Pflege jeder Stadt ist fehleranfällig und verhindert zugleich die Nutzung stabiler adressbasierter Push-Ziele.

## What Changes

- Ergänzt unter „Datentools → Erweiterte Systemfunktionen“ eine administrative Aktion für fehlende Stadt-Postleitzahlen.
- Führt die Anreicherung als mandantenisolierten, nachvollziehbaren Hintergrundjob aus.
- Verwendet die hostgeführte Geocoding-Konfiguration mit konservativer Plausibilitäts- und Konsensprüfung.
- Überschreibt niemals bereits vorhandene oder während des Laufs ergänzte Postleitzahlen.
- Meldet Fortschritt sowie aggregierte Ergebnisse für ergänzte, offene, mehrdeutige und fehlgeschlagene Städte.

## Impact

- Affected specs: `waste-management`
- Affected code: Waste-Operations-Vertrag, Job-Runtime, Auth-Fassade, Repository, Datentools-UI und Geocoding-Hostadapter
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
