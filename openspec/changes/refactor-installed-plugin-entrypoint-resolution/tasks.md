## 1. Vorbereitung

- [x] 1.1 Den aktuellen Katalog-, Vite-, Browser-, Server-, Job- und Artefaktpfad für `studio`/`ssf` inventarisieren und gegen #1511 sowie offene Plugin-Changes abgleichen.
- [x] 1.2 Proposal und Design einschließlich der Importgraph- und Pfadgrenzen reviewen; den konkreten Testverbraucher und die PR-Grenze bestätigen.

## 2. Build und Loader

- [x] 2.1 Gewählte installierte Katalogeinträge samt Profilzuordnung beim Build aus der bestehenden Konfiguration lesen und Manifest-/Paketpfade vor statischen Imports validieren.
- [x] 2.2 Browser-, Descriptor-, Server- und Job-Entrypoints manifesttreu in die bestehenden Build-Register einspeisen; ersetzte feste installierte Globs entfernen.
- [x] 2.3 Profilfilter, bestehende Snapshot-Validierung und Trennung von Installation und Tenant-Aktivierung erhalten.
- [x] 2.4 Den ausgewählten installierten Paketsatz in die bestehende Image-/Chunk-Verifikation aufnehmen, ohne eine zweite Katalogentscheidung einzuführen.

## 3. Nachweise

- [x] 3.1 Eine temporär gepackte Distribution mit beliebigem Paketnamen und getrennten Entrypoints tatsächlich installieren und ihre Browser-/Server-/Job-Auflösung prüfen.
- [x] 3.2 Fehlende, inkompatible, außerhalb des Pakets liegende und nicht ausgewählte Entrypoints sowie ausgeschlossene Chunks negativ prüfen.
- [x] 3.3 Gezielte Nx-Unit-/Type-Gates, beide Profil-Builds, `pnpm check:server-runtime`, Artefakt- und Dateiplatzierungs-Gates ausführen; bei Änderungen an Root-/CI-TypeScript zusätzlich `pnpm exec tsc -p tsconfig.scripts.json --noEmit`.
- [x] 3.4 `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md` und `docs/development/plugin-development.md` aktualisieren; OpenSpec strikt validieren.
