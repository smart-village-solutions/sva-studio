## 1. Auth-Composition

- [x] 1.1 Den optionalen, typisierten Account-Create-Beitrag im bestehenden
      Runtime-Snapshot anbinden; fehlender Beitrag führt den Core-Create ohne
      plugin-eigene Claims aus.
- [x] 1.2 Die SSF-Ableitung in das SSF-Plugin verlagern, an der SSF-Composition
      Root mit vorhandener Tenant-Readiness verdrahten und SSF-OIDC-Anforderungen
      ausschließlich im SSF-Profil laden.
- [x] 1.3 Den ersetzten SSF-Helper samt Tests im gemeinsamen Auth-Package
      entfernen und dessen SSF-Runtime-Dependency löschen.

## 2. Nachweise

- [x] 2.1 Profil-, Snapshot- und Account-Create-Tests für Standard-Studio ohne
      SSF, SSF mit vier Claims, blockierte Readiness und Tenant-Sperre ergänzen.
- [x] 2.2 Die gezielten Nx-Unit-/Type-Gates, `pnpm check:server-runtime`,
      `pnpm check:file-placement` und einen Artefaktcheck ohne SSF-Runtime-Import
      im Standard-Profil für den exakten HEAD ausführen; das vollständige
      Distribution-Image-Verify bleibt #1408.
- [x] 2.2a Das bestehende Nx-Build-Input um `SVA_STUDIO_DISTRIBUTION` ergänzen
      und die beiden Profile gegen getrennte, nachweislich richtige Manifeste bauen.
- [x] 2.3 Die betroffenen arc42-Abschnitte 04, 05, 06 und 08 aktualisieren,
      die Auth-Composition-Entscheidung in ADR-041 fortschreiben und in Abschnitt 09
      verlinken.
