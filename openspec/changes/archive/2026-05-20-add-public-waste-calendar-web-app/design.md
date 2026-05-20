## Context
Das bestehende `waste-management` im Studio dient der administrativen Pflege des kommunalen Abfallkalenders. Für die öffentliche Nutzung wird nun eine eigenständige, deutlich schlankere Web-App benötigt, die sich in andere Webseiten per iFrame einbetten lässt und ohne Studio-Login arbeitet. Die Datenquelle bleibt dieselbe Waste-Supabase, die Zugriffe müssen aber serverseitig gekapselt werden.

## Goals / Non-Goals
- Goals:
  - öffentliche, minimalistische Web-App für den Abfallkalender
  - serverseitige Kapselung von lokaler Konfiguration und Supabase-Zugang
  - datengetriebene Standortauflösung mit Cookie-basierter Wiederherstellung
  - konsistente Ausspielung von Terminliste, Monats-/Jahreskalender, PDF-Links und iCal-Feed
  - praktisch sofort sichtbare Datenänderungen ohne periodischen Build-Prozess
- Non-Goals:
  - keine Wiederverwendung der Studio-Plugin-UI
  - keine öffentliche Schreibfunktion
  - keine eigenständige PDF-Erzeugungslogik in der App
  - kein breit angelegtes Public-Read-Model im ersten Ausbau

## Decisions
- Decision: Die Funktion wird als eigene Capability `public-waste-calendar` modelliert.
  - Alternatives considered:
    - Erweiterung der Capability `waste-management`: verwischt die bewusste Trennung zwischen Admin und öffentlicher Ausspielung.
    - Reine Dokumentation ohne eigene Capability: macht öffentliche Verträge und Qualitätsanforderungen zu implizit.
- Decision: Die App lädt eine lokale JSON-Konfiguration serverseitig und hält Credentials vollständig aus dem Browser heraus.
  - Alternatives considered:
    - Direkter Browser-Zugriff auf Supabase: widerspricht Sicherheits- und Betriebsanforderungen.
    - Nutzung der Studio-Host-Fassade: würde eine unnötige Kopplung an Studio-Auth und Admin-Kontext erzeugen.
- Decision: Die erste Version liest direkt aus der bestehenden `waste_*`-Datenstruktur.
  - Alternatives considered:
    - Vorab materialisiertes Public-Read-Model: erhöht Komplexität und erschwert das Ziel praktisch sofortiger Aktualität.
- Decision: PDF bleibt ein externer URL-Vertrag, iCal wird von der App selbst serverseitig erzeugt.
  - Alternatives considered:
    - PDF-Erzeugung in der App: unnötige Verantwortungsvermischung.
    - Externer iCal-Dienst: würde die Konsistenz zum öffentlichen Kalender schwächen.

## Risks / Trade-offs
- Direktes Lesen aus der Admin-Datenstruktur kann komplexere Queries erfordern.
  - Mitigation: Repository und Calendar Service klar trennen und spätere Projektion als Folgeoption offenhalten.
- Cookie-Verhalten im iFrame kann je nach Einbettungskontext eingeschränkt sein.
  - Mitigation: Cookie-Strategie früh gegen Zielumgebung prüfen und sichtbaren Fallback auf erneute Auswahl vorsehen.
- Kalender-Interaktionen und Modal können Accessibility-Risiken bergen.
  - Mitigation: WCAG 2.1 AA als explizite Pflichtanforderung plus dedizierte A11y-Tests festschreiben.

## Migration Plan
1. Neue Capability spezifizieren.
2. Öffentliche App-Struktur und serverseitige Read-Verträge implementieren.
3. Standortauflösung, Kalenderdarstellungen und Export-Aktionen integrieren.
4. A11y-, Integrations- und E2E-Abdeckung ergänzen.
5. Relevante arc42-Abschnitte aktualisieren.

## Open Questions
- Keine offenen fachlichen Fragen aus dem abgestimmten Designstand.
