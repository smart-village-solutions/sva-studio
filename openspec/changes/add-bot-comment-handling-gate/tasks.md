## 1. Specification

- [ ] 1.1 Bearbeitungsnachweis fuer Bot-Review-Threads und normale Bot-PR-Kommentare in `review-governance` spezifizieren
- [ ] 1.2 Statusmodell fuer `accepted`, `rejected` und sonstige erledigte Bot-Kommentare als Governance-Anforderung dokumentieren
- [ ] 1.3 Blockierendes PR-Qualitygate fuer unbearbeitete Bot-Kommentare spezifizieren
- [ ] 1.4 `openspec validate add-bot-comment-handling-gate --strict` ausfuehren

## 2. Implementation

- [ ] 2.1 GitHub-Workflow fuer das Bot-Kommentar-Gate unter `.github/workflows/` einfuehren
- [ ] 2.2 GitHub-API-Auswertung fuer Review-Threads und normale PR-Kommentare unter `scripts/ci/` implementieren
- [ ] 2.3 Standardisierte Bearbeitungsmarker und ihre Validierungsregeln dokumentieren
- [ ] 2.4 Architektur- und Governance-Dokumentation fuer das neue Gate aktualisieren
- [ ] 2.5 Tests fuer offene, beantwortete, abgelehnte und aufgeloeste Bot-Kommentare ergaenzen
