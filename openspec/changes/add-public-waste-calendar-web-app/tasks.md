## 1. Spezifikation und Architektur
- [x] 1.1 Neue Capability `public-waste-calendar` unter `openspec/changes/add-public-waste-calendar-web-app/specs/public-waste-calendar/spec.md` ausformulieren
- [x] 1.2 Technisches Change-Design unter `openspec/changes/add-public-waste-calendar-web-app/design.md` aus dem abgestimmten Design-Spec ableiten
- [x] 1.3 Betroffene arc42-Abschnitte identifizieren und für die spätere Implementierung als Pflichtupdates referenzieren

## 2. Öffentliche App-Struktur
- [x] 2.1 Neue öffentliche App im Monorepo anlegen und als eigenständige deploybare Oberfläche vom Studio-Plugin trennen
- [x] 2.2 Lokale JSON-Konfiguration mit Validierung für `instanceId`, Supabase-Zugang, Cookie-Einstellungen und PDF-URL-Schema einführen
- [x] 2.3 Serverseitige Bootstrapping- und Fehlerseitenpfade für fehlende oder ungültige Konfiguration spezifizieren

## 3. Öffentliche Read-Schicht
- [x] 3.1 App-lokales serverseitiges Public Waste Repository für Regionen, Orte, Straßen, Hausnummern beziehungsweise Hausnummerbereiche, Abholorte, Fraktionen und Termine einführen
- [x] 3.2 App-lokalen datengetriebenen `Location Resolver` für den schrittweisen Auswahlfluss und den stabilen Standortschlüssel spezifizieren
- [x] 3.3 App-lokalen `Calendar Service` für Terminliste, Monatsansicht, Jahresansicht, Hinweistexte und Fraktionsfilter spezifizieren
- [x] 3.4 Öffentliche Read-Endpunkte für nächste Auswahlstufe, finalen Kalender und iCal-Feed spezifizieren

## 4. Öffentliche UX und Zustandsverhalten
- [x] 4.1 Reduzierte iFrame-taugliche UI mit Abschluss-erst-dann-Laden-Verhalten spezifizieren
- [x] 4.2 Cookie-basierten Preference Store für genau einen gemerkten Standort spezifizieren
- [x] 4.3 Hinweis- und Wiederherstellungsverhalten für automatisch geladene gespeicherte Adressen spezifizieren
- [x] 4.4 Klickbare Termin-Details im Modal sowie globale PDF- und iCal-Aktionen spezifizieren

## 5. Qualität, Tests und Dokumentation
- [x] 5.1 Teststrategie für Unit-, Integrations-, E2E- und Accessibility-Tests festschreiben
- [x] 5.2 WCAG-2.1-AA-Ziele für Auswahlfluss, Kalender, Modal und iFrame-Einsatz als Pflichtanforderung festschreiben
- [x] 5.3 Architektur- und Betriebsdokumentation in den referenzierten arc42-Abschnitten fortschreiben oder eine begründete Abweichung dokumentieren
