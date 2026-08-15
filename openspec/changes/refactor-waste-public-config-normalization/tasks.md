## 1. Vertrag und Characterization

- [ ] 1.1 Konfliktfreiheit mit offenen Waste-PRs, aktiven Worktrees und Changes prüfen
- [ ] 1.2 OpenSpec-Change strikt validieren
- [ ] 1.3 Gültige, partielle, fehlerhafte und unbekannte Eingaben vor Sourceänderung charakterisieren
- [ ] 1.4 Serialisierungs- und Secret-Grenze vor Sourceänderung charakterisieren
- [ ] 1.5 Fokussierten Core-Unit-Test als grüne Baseline ausführen

## 2. Implementierung

- [ ] 2.1 Kleine typsichere Parser entlang bestehender Feldgruppen extrahieren
- [ ] 2.2 Explizite fail-closed Orchestrierung und Ausgabeform unverändert erhalten
- [ ] 2.3 Keine neue Abhängigkeit, kein `any` und keine Suppression einführen
- [ ] 2.4 Relevante arc42-Abschnitte 05, 08, 10 und 11 aktualisieren
- [ ] 2.5 Complexity-Baseline nur über den kanonischen Vertrag und bei belegter Senkung aktualisieren

## 3. Verifikation und Lieferung

- [ ] 3.1 Core Unit, Types, Lint und Server-Runtime ausführen
- [ ] 3.2 Betroffene Waste-Konsumenten typprüfen
- [ ] 3.3 Complexity-Gate, Fallow und OpenSpec strict ausführen
- [ ] 3.4 Affected-Scope messen und kleinsten relevanten PR-Gate-Pfad ausführen
- [ ] 3.5 Gesamtdiff prüfen, committen, pushen und Draft-PR mit Changelog öffnen
- [ ] 3.6 Root-Diffreview, Ready-Status, SHA-gebundene CI und Review-Threads betreuen
