## 1. Implementierung

- [x] 1.1 SSF-Build und -Verifikation aus `build.yml` entfernen; Studio-Dev-Abhängigkeiten und getrennte Concurrency prüfen.
- [x] 1.2 Manuellen, auf `main` begrenzten SSF-Build mit Quell-SHA-Bindung und Image-Verifikation ergänzen.
- [x] 1.3 Studio-Hotfix-Evidenz ohne SSF-Pflichtdigest schreiben und bisherige Nachweise weiterhin verifizieren.
- [x] 1.4 Gezielte Workflow- und Hotfix-Vertragstests ergänzen und ausführen; Skript-Typecheck und `check:file-placement` ausführen.
- [x] 1.5 Normativen Rollout-Prozess, Kasseler Runbook und arc42-Deployment-Sicht aktualisieren.

## 2. Betriebsnachweis nach Merge

- [ ] 2.1 Den exakten Main-Build bis zum terminalen Dev-Ergebnis und den ersten manuell gestarteten SSF-Build bis zum verifizierten Digest prüfen, bevor ein Kassel-Release diesen verwendet.
