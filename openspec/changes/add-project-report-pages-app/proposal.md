# Change: Separate Project Report App

## Why
Die öffentliche Fortschrittsansicht für Meilensteine und Arbeitspakete hat andere Anforderungen als die interne Studio-App: statische Auslieferung, reduzierte öffentliche Datenbasis, teilbare Filter-URLs und eine klar getrennte Build-/Deploy-Kette.

Die bestehende App `apps/sva-studio-react` soll nicht mit einer zusätzlichen öffentlichen Reporting-Oberfläche, GitHub-Pages-spezifischen Anforderungen und separater Visualisierungslogik belastet werden.

## What Changes
- Ergänzt eine eigenständige Nx-App `apps/project-report` für die öffentliche Projektberichterstattung.
- Führt eine eigenständige Reporting-Capability für öffentliche Fortschrittsdarstellung von Meilensteinen und Arbeitspaketen ein.
- Verankert die Nutzung des öffentlichen JSON-Datenmodells als kanonische Datenquelle für die Reporting-App.
- Trennt die öffentliche Reporting-App architektonisch von `apps/sva-studio-react`, inklusive eigenem Build- und Test-Target.

## Impact
- Affected specs: `monorepo-structure`, `project-reporting`
- Affected code: `apps/project-report/**`, gemeinsame Reporting-Datenquelle, Nx-Projektkonfiguration
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`
