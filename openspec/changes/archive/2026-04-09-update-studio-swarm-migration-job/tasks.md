## 1. Umsetzung

- [x] 1.1 Dedizierten `migrate`-Service und separaten Migrations-Entrypoint im Runtime-Image ergänzen
- [x] 1.2 Runtime-CLI auf temporären Swarm-Migrationsjob statt Remote-`exec`-Pfad umstellen
- [x] 1.3 Dedizierten `bootstrap`-Service und separaten Bootstrap-Entrypoint im Runtime-Image ergänzen
- [x] 1.4 Runtime-CLI für Post-Migration-Mutationen auf temporären Swarm-Bootstrap-Job umstellen
- [x] 1.5 Verify- und Report-Pfad von `quantum-cli exec` auf Swarm-/HTTP-Signale umstellen
- [x] 1.6 Deploy-Reports um Migrations- und Bootstrap-Artefakte sowie Metadaten erweitern
- [x] 1.7 Unit-Tests für Job-Compose-Ableitung, Task-Statusauswertung und Report-Änderungen ergänzen
- [x] 1.8 Betriebs- und Architekturdokumentation auf den neuen Job-Pfad aktualisieren
- [x] 1.9 OpenSpec-Deltas für Deployment-Topologie und Architekturdokumentation ergänzen
- [x] 1.10 Die Job-basierte Migrations-/Bootstrap-Mechanik als vorausgesetzte Grundlage für nachgelagerte Rollout-Changes dokumentieren
