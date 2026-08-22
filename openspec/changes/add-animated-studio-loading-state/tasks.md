## 1. Gemeinsamer Ladezustand

- [x] 1.1 Anime.js als lokale Runtime-Abhängigkeit von `@sva/studio-ui-react` hinzufügen und Lizenz sowie Package-Metadaten prüfen.
- [x] 1.2 Wiederverwendbaren animierten Studio-Ladezustand mit Content-Assembly-SVG, Design-Tokens und kontextbezogenem Statustext implementieren.
- [x] 1.3 Anime.js bedingt laden, komponentenlokal kapseln und bei Unmount vollständig bereinigen.
- [x] 1.4 `prefers-reduced-motion: reduce` ohne laufende Timeline und mit statischem Motiv unterstützen.

## 2. Inhalts-Detailseiten

- [x] 2.1 Ressourcenprincipal-Auflösung in getrennte Zustände `loading`, `ready` und `error` überführen, ohne die Fail-closed-Logik zu verändern.
- [x] 2.2 Den animierten Ladezustand für `loading` und die bestehende dauerhafte Fehlermeldung ausschließlich für `error` verwenden.
- [x] 2.3 Sicherstellen, dass der Editor nach erfolgreicher Auflösung ohne Mindestanzeigedauer oder blockierenden Austritt erscheint.

## 3. Startseite vor und nach dem Login

- [x] 3.1 Wiederverwendbare Studio-Workbench-Szene mit Arbeitsraster sowie Inhalts-, Medien-, Organisations- und Erweiterungsbausteinen implementieren.
- [x] 3.2 Vollständige und kompakte Timeline-Varianten umsetzen, ohne Rendern, Fokus, Pointer Events oder Navigation zu blockieren.
- [x] 3.3 Vollständige Wiedergabe anonym und authentifiziert getrennt und PII-frei einmal je Browser-Sitzung speichern; Storage-Ausfälle kompakt abfangen.
- [x] 3.4 Anonyme Startseite mit parallelem Werkbank-Aufbau versehen und Login-, Dev-Login- sowie Fehleraktionen unverändert sofort bedienbar halten.
- [x] 3.5 Authentifizierte Startseite mit berechtigungsabhängigem Einsetzen vorhandener Aktionskarten und Changelog-Arbeitsfläche versehen.
- [x] 3.6 Fest codierte sichtbare Home-Texte in vollständige deutsche und englische Übersetzungsressourcen verschieben.

## 4. Qualitätssicherung und Dokumentation

- [x] 4.1 Unit-Tests für Semantik, visuelle Varianten, Reduced Motion, dynamischen Import und Cleanup ergänzen.
- [x] 4.2 Routing-Regressionstests für Ladezustand, echten Fehler und unverzögerten erfolgreichen Übergang ergänzen; eine blockierende Verzögerung über 500 ms ausschließen.
- [x] 4.3 Home-Tests für anonyme und authentifizierte Erstsequenz, kompakte Wiederholung, Permission-abhängige Karten, Storage-Ausfall und sofort bedienbare Aktionen ergänzen.
- [x] 4.4 Relevante Unit-, Type-, ESLint- und Frontend-Build-Gates über Nx ausführen.
- [x] 4.5 `docs/architecture/08-cross-cutting-concepts.md` um den gemeinsamen Motion- und Ladezustandsvertrag ergänzen.
- [x] 4.6 Dependency-/Bundle-Auswirkung dokumentieren und prüfen, dass Anime.js-Code nur in tatsächlich gemounteten Motion-Komponenten initialisiert wird.
