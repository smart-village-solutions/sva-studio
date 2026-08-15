## 1. Vertrag und Characterization

- [x] 1.1 Konfliktfreiheit mit offenen Waste-PRs, aktiven Worktrees und Changes prüfen
- [x] 1.2 OpenSpec-Change strikt validieren
- [x] 1.3 Gültige, partielle, fehlerhafte und unbekannte Eingaben vor Sourceänderung charakterisieren
- [x] 1.4 Serialisierungs- und Secret-Grenze vor Sourceänderung charakterisieren
- [x] 1.5 Fokussierten Core-Unit-Test als grüne Baseline ausführen

## 2. Implementierung

- [x] 2.1 Kleine typsichere Parser entlang bestehender Feldgruppen extrahieren
- [x] 2.2 Explizite fail-closed Orchestrierung und Ausgabeform unverändert erhalten
- [x] 2.3 Keine neue Abhängigkeit, kein `any` und keine Suppression einführen
- [x] 2.4 Relevante arc42-Abschnitte 05, 08, 10 und 11 aktualisieren
- [x] 2.5 Complexity-Baseline nur über den kanonischen Vertrag und bei belegter Senkung aktualisieren

## 3. Verifikation und Lieferung

- [x] 3.1 Core Unit, Types, Lint und Server-Runtime ausführen
- [x] 3.2 Betroffene Waste-Konsumenten typprüfen
- [x] 3.3 Complexity-Gate, Fallow und OpenSpec strict ausführen
- [x] 3.4 Affected-Scope messen und kleinsten relevanten PR-Gate-Pfad ausführen
- [ ] 3.5 Gesamtdiff prüfen, committen, pushen und Draft-PR mit Changelog öffnen
- [ ] 3.6 Root-Diffreview, Ready-Status, SHA-gebundene CI und Review-Threads betreuen
