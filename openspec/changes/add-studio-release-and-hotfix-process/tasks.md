## 1. Freigabe und Baseline

- [ ] Proposal, Design, Invarianten und ADR-066 prüfen und freigeben; offene Workflow-PRs sowie aktuellen `main`-Stand erneut abgleichen.
- [x] Production read-only auf Live-Digest, OCI-Revision, Commit und gebundene Config-Revision prüfen; bei Unklarheit keine Baseline setzen.
- [x] Tag-Konvention und geschützte GitHub-Release-Berechtigungen prüfen; `studio-v0.10.4` erst auf den belegten Production-Commit setzen und das erste GitHub-Release als Ausgangsstand veröffentlichen.

## 2. Nutzer-Changelog und reguläres Release

- [x] Bestehendes PR-Changelog-Gate so ändern, dass rein technische PRs ohne Eintrag bestehen, vorhandene Einträge aber weiter validiert werden; passende Vitest-Vertragstests ergänzen.
- [x] Bestehenden Changelog-Generator auf nutzerrelevante, tatsächlich ausgelieferte Änderungen begrenzen; keine Auswahl allein nach höchster PR-Nummer. Release-/Hotfix-Bereiche, technische Updates und das nächste reguläre Release nach einem übernommenen Hotfix ohne doppelte Ankündigung gezielt testen. Die spätere Entscheidung entfernt die PR-Anzeige aus dem Dashboard.
- [x] GitHub-Release-Notes aus demselben ausgelieferten Bereich erstellen und vor Veröffentlichung redaktionell prüfen; Beta als Pre-release kennzeichnen, stabiles Release erst nach Live-Prod-Nachweis veröffentlichen.
- [x] Regulären Kandidaten von einem festen `main`-SHA mit existierendem Digest über Staging und Production prüfen; `main`→Dev und alle bisherigen Promote-Gates erhalten.

## 3. Prod-Hotfix im bestehenden Pfad

- [ ] Den vorhandenen `Build` auf dem aktuellen `main`-Controller für einen expliziten Hotfix-Dispatch erweitern: Prod-Basistag, Hotfix-Ref und SHA validieren, exakt diesen SHA auschecken; Build-Argumente, OCI-Revision, unveränderliche Tags und Verifikation aller dabei veröffentlichten Images an den Quell-SHA statt an `github.sha` des Controllers binden. Für keines der Images `latest` verschieben und keinen automatischen Dev-Promote erzeugen; die SHA-Bindung und Nicht-Mutation aller Aliasse gezielt testen.
- [ ] Vollständigen App-E2E-Lauf über den aktuellen `main`-Controller für denselben expliziten Hotfix-Dispatch ausführen und bestehende Evidenzvalidatoren für Controller-Revision, Modus, Ref, Head-SHA, Run-ID/Attempt und terminales Ergebnis erweitern; PR-, gewöhnliche manuelle, Nightly- und fremde Branch-Läufe negativ testen.
- [ ] Staging-Preflight und Paritätsevidenz um die Hotfix-Quellklasse erweitern; OCI-Revision und unveränderlichen Digest unabhängig prüfen.
- [ ] Den Wechsel eines gemeinsamen Staging von Beta auf Prod-basierten Hotfix im geschützten `Promote`-Pfad prüfen: tatsächliche Live-Basis, Schema-/Config-Kompatibilität, Backup, One-shots, Smokes und frische Parität. Bei unklarer Kompatibilität vor Mutation stoppen. Den Rückwechsel zur Beta mit neuer Parität prüfen.
- [ ] Vor dem ersten Hotfix-Build prüfen, ob der alte Production-Quellstand die zugesagte Changelog-Auswahl im gebauten Artefakt beherrscht; andernfalls die kleinste nötige Generatoranpassung auf dem Hotfix-Zweig mitnehmen und das Artefakt gezielt prüfen.
- [ ] Einen exemplarischen Patch vom Prod-Tag über Staging und geschütztes Production mit gleichem Digest nachweisen und den Fix samt ursprünglichem Changelog-Eintrag danach auf `main` führen; keine Veröffentlichung allein aufgrund grüner CI und keine doppelte Ankündigung beim nächsten regulären Release.

## 4. Dokumentation und Abschluss

- [x] `docs/guides/studio-rollout-process.md` als einzigen normativen Bedienablauf für reguläres Release, Beta, Hotfix und Staging-Wechsel fortschreiben.
- [x] Betroffene arc42-Abschnitte 04, 07, 09, 10 und 11 gezielt aktualisieren; ADR-066 nach Review von Proposed auf Accepted setzen und Indizes konsistent halten.
- [ ] Pflicht-Gates für Workflow-/Skriptänderungen einschließlich Skript-Typecheck, gezielter Vitest-Tests, File-Placement und geschützter Rollout-Contract-Tests ausführen; exakten HEAD und Live-Ergebnis getrennt dokumentieren.
