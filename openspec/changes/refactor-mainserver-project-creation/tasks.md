## 1. Characterization

- [x] 1.1 Autorisierungs- und Validierungsablehnungen vor Seiteneffekten absichern
- [x] 1.2 Erfolgsreihenfolge von Provider-Create bis Idempotenz-Completion absichern
- [x] 1.3 Provider-, Visibility- und lokale Folgefehler einschließlich fehlender Rollbacks absichern
- [x] 1.4 Replay-, Konflikt- und Recovery-Pfade unverändert abdecken

## 2. Modulare Ownership

- [x] 2.1 reine Payload-, Projection- und Response-Abbildung von I/O trennen
- [x] 2.2 Create-Orchestrierung und Idempotenz-/Recovery-Pfade in interne Module extrahieren
- [x] 2.3 gemeinsame Autorisierungs- und Transportbausteine ohne öffentliche API-Erweiterung abgrenzen
- [x] 2.4 Node-ESM-konforme Runtime-Imports und zyklusfreie Abhängigkeiten sicherstellen

## 3. Dokumentation und Verifikation

- [x] 3.1 arc42-Baustein-, Runtime- und Querschnittssicht aktualisieren
- [x] 3.2 vollständige Mainserver Unit-, Types- und Runtime-Gates ausführen
- [x] 3.3 Complexity-Gate und Fallow-Vorher-/Nachher-Nachweis ausführen
- [x] 3.4 `openspec validate refactor-mainserver-project-creation --strict` ausführen
