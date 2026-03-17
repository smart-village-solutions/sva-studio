## ADDED Requirements

### Requirement: Blockierender Rechtstext-Akzeptanzflow

Das System MUST im Frontend einen blockierenden Akzeptanzflow für offene Pflicht-Rechtstexte bereitstellen.

#### Scenario: Nutzer landet nach Login im Akzeptanz-Interstitital

- **WENN** ein Nutzer mit offener Pflicht-Akzeptanz die Anwendung öffnet oder nach dem Login zurückkehrt
- **DANN** sieht er einen dedizierten Akzeptanzscreen vor allen geschützten Fachansichten
- **UND** reguläre Navigation, Deep-Links und geschützte Admin-Routen bleiben bis zur Entscheidung gesperrt

#### Scenario: Rechtstext-Akzeptanz ist barrierefrei und eindeutig

- **WENN** der Akzeptanzscreen angezeigt wird
- **DANN** sind Version, Gültigkeit, Pflichtcharakter und die auslösbare Aktion eindeutig sichtbar
- **UND** der Flow ist vollständig tastatur- und screenreader-bedienbar

### Requirement: Admin-Oberfläche für Rechtstext-Nachweise

Das System MUST Administratoren eine explizite UI für Nachweis, Filterung und Export von Rechtstext-Akzeptanzen bereitstellen.

#### Scenario: Admin exportiert Akzeptanznachweise

- **WENN** ein berechtigter Administrator die Rechtstext-Verwaltung oder Governance-Sicht öffnet
- **DANN** kann er Akzeptanzen nach Benutzer, Text, Version und Zeitraum filtern
- **UND** einen revisionssicheren Nachweis exportieren

#### Scenario: Unberechtigter Nutzer sieht keine Nachweisdaten

- **WENN** ein Nutzer ohne passende Berechtigung eine Nachweis- oder Exportansicht aufruft
- **DANN** werden keine sensitiven Akzeptanzdaten offengelegt
- **UND** die UI zeigt einen sicheren verweigerten Zustand
