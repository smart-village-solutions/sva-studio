## ADDED Requirements

### Requirement: Nativer Client-Releasekanal bleibt vom Studio-Rollout getrennt

Das System SHALL native macOS-Artefakte separat versionieren, prüfen und veröffentlichen, ohne den kanonischen Studio-Rollout `Build` → Dev → Staging → Production zu verändern oder einen konkurrierenden Server-Deploypfad einzuführen.

#### Scenario: Studio-Server wird ausgerollt

- **WENN** ein regulärer Studio-Rollout erfolgt
- **DANN** bleibt ausschließlich `docs/guides/studio-rollout-process.md` für Dev, Staging und Production normativ
- **UND** ist kein nativer Client-Build Voraussetzung für die Server-Promotion

#### Scenario: Produktives macOS-Pilotartefakt wird veröffentlicht

- **WENN** ein macOS-Pilotartefakt produktiv verteilt werden soll
- **DANN** ist es an eine nachvollziehbare Quellrevision und Version gebunden
- **UND** liegen erfolgreiche native Tests, Apple-Signatur, Notarisierungsnachweis und Prüfsummen vor
- **UND** blockiert fehlende Evidenz die Veröffentlichung

### Requirement: Rückwärtskompatibler Vertrag für unterstützte native Clients

Das System SHALL die Nachrichten-API versionieren und während des dokumentierten Supportfensters rückwärtskompatibel für unterstützte native Clientversionen betreiben.

#### Scenario: Server wird vor dem nativen Client aktualisiert

- **WENN** eine neue Studio-Serverversion ausgerollt wird
- **UND** ein unterstützter nativer Client verwendet weiterhin die bestehende API-Version
- **DANN** bleiben Summary, Liste und Gelesen-Mutation vertragskompatibel
- **ODER** eine absichtliche Inkompatibilität wird als eigener Breaking-Change mit Migration und Client-Rollout spezifiziert
