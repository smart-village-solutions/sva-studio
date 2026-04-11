## 1. Implementierung

- [x] 1.1 Offiziellen Server-Entry der App explizit an TanStack Start anbinden und den finalen `.output/server/**`-Vertrag im Build nachweisbar machen
- [x] 1.2 Neues Nx-Target `verify:runtime-artifact` plus lokales Final-Artifact-Verify-Skript einfuehren
- [x] 1.3 Runner-basiertes `studio`-Image-Verify auf Migrationen, Keycloak-Admin-Mock und phasenklassifizierte Diagnostik erweitern
- [x] 1.4 Entrypoint-Patch hinter explizites Recovery-Flag stellen
- [x] 1.5 `Studio Image Build` so aendern, dass der finale Runtime-Vertrag vor dem Docker-Build validiert wird
- [x] 1.6 Fail-fast-Toolchain-Check einfuehren und vor dem App-Build ausfuehren
- [x] 1.7 Finalen Build-Output deterministisch patchen, sodass der produktive Nitro-Entry an einen finalen generierten TanStack-Server-Entry delegiert statt den Recovery-Patch erst im Container zu brauchen

## 2. Dokumentation und Spezifikation

- [x] 2.1 OpenSpec-Deltas fuer Deployment-, Monorepo- und Architekturdokumentations-Vertrag ergaenzen
- [x] 2.2 Betroffene arc42-Abschnitte und das Runtime-Runbook auf den neuen finalen Runtime-Vertrag aktualisieren

## 3. Verifikation

- [x] 3.1 Betroffene Unit-Tests, Build, Final-Artifact-Verify und Bash-/Script-Checks ausfuehren
- [x] 3.2 OpenSpec- und Repository-Checks (`openspec validate`, `check:file-placement`) erfolgreich ausfuehren
