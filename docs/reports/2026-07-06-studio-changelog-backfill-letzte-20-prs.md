# Studio-Changelog-Backfill der letzten 20 PRs

## Zweck

Diese Liste dient als Arbeitsgrundlage, um für die zuletzt nach
`main` gemergten Pull Requests rückwirkend Studio-Changelog-Einträge
unter `docs/changelog/entries/pr-<nummer>.json` anzulegen.

Stand der Ermittlung: 2026-07-06  
Quelle: GitHub-Metadaten über `gh pr list --state merged --limit 20`

## Letzte 20 gemergte PRs

| PR | Merge-Zeitpunkt (UTC) | Titel | Vorschlag für `body` |
| --- | --- | --- | --- |
| [#686](https://github.com/smart-village-solutions/sva-studio/pull/686) | 2026-07-06 16:57 | `fix: hard delete leaf organizations` | `Untergeordnete Organisationen lassen sich jetzt zuverlässiger endgültig löschen.` |
| [#685](https://github.com/smart-village-solutions/sva-studio/pull/685) | 2026-07-06 15:44 | `Fix event and POI persistence gaps` | `Änderungen an Veranstaltungen und Orten werden jetzt zuverlässiger gespeichert.` |
| [#687](https://github.com/smart-village-solutions/sva-studio/pull/687) | 2026-07-06 15:43 | `fix(iam): delete user cleanup must use keycloak subject` | `Das endgültige Entfernen von Nutzerkonten wurde robuster umgesetzt.` |
| [#684](https://github.com/smart-village-solutions/sva-studio/pull/684) | 2026-07-06 13:29 | `Unify media editing UI across content plugins` | `Die Medienbearbeitung wirkt jetzt in mehreren Inhaltsbereichen einheitlicher und konsistenter.` |
| [#683](https://github.com/smart-village-solutions/sva-studio/pull/683) | 2026-07-06 08:47 | `fix(plugin-events): use date-only fields for event dates` | `Veranstaltungsdaten werden im Studio jetzt präziser und ohne unnötige Zeitanteile verarbeitet.` |
| [#682](https://github.com/smart-village-solutions/sva-studio/pull/682) | 2026-07-06 07:09 | `fix(studio): deduplicate projected mainserver content rows` | `Doppelte Inhaltseinträge in Übersichten wurden weiter reduziert.` |
| [#681](https://github.com/smart-village-solutions/sva-studio/pull/681) | 2026-07-06 04:52 | `feat(generic-items): add editorial generic item plugin` | `Neu im Studio:\n\n- Ein neuer Inhaltsbereich für generische redaktionelle Einträge wurde ergänzt.` |
| [#680](https://github.com/smart-village-solutions/sva-studio/pull/680) | 2026-07-05 22:35 | `feat(iam): add admin hard delete for tenant accounts` | `Neu im Administrationsbereich:\n\n- Tenant-Konten können jetzt gezielter endgültig entfernt werden.` |
| [#679](https://github.com/smart-village-solutions/sva-studio/pull/679) | 2026-07-05 15:03 | `Refactor server mutation workflows and harden boundaries` | `Mehrere serverseitige Abläufe im Studio wurden stabilisiert.` |
| [#678](https://github.com/smart-village-solutions/sva-studio/pull/678) | 2026-07-05 11:38 | `Refine waste sync progress presentation` | `Die Fortschrittsanzeige bei Waste-Synchronisationen ist jetzt klarer und leichter nachvollziehbar.` |
| [#677](https://github.com/smart-village-solutions/sva-studio/pull/677) | 2026-07-05 09:37 | `Fix system admin organization context handling` | `Der Organisationskontext für System-Admins wird jetzt konsistenter behandelt.` |
| [#675](https://github.com/smart-village-solutions/sva-studio/pull/675) | 2026-07-04 11:08 | `fix: tolerate missing survey option question ids` | `Umfragen bleiben robuster, wenn einzelne Antwortoptionen unvollständig hinterlegt sind.` |
| [#673](https://github.com/smart-village-solutions/sva-studio/pull/673) | 2026-07-02 22:11 | `fix: align survey adapter with mainserver snapshot` | `Die Anbindung des Umfragebereichs wurde an den aktuellen Backend-Stand angepasst.` |
| [#668](https://github.com/smart-village-solutions/sva-studio/pull/668) | 2026-07-02 15:58 | `feat: add surveys content plugin` | `Neu im Studio:\n\n- Ein eigener Inhaltsbereich für Umfragen wurde ergänzt.` |
| [#669](https://github.com/smart-village-solutions/sva-studio/pull/669) | 2026-07-01 22:48 | `build(deps): bump the tanstack group across 1 directory with 2 updates` | `Die technischen Grundlagen für Routing und Datenflüsse im Studio wurden aktualisiert.` |
| [#666](https://github.com/smart-village-solutions/sva-studio/pull/666) | 2026-07-01 19:50 | `build(deps-dev): bump @vitejs/plugin-react from 5.2.0 to 6.0.3` | `Die React-Build-Grundlagen des Studios wurden aktualisiert.` |
| [#665](https://github.com/smart-village-solutions/sva-studio/pull/665) | 2026-07-01 19:49 | `build(deps-dev): bump @tailwindcss/vite from 4.2.4 to 4.3.2` | `Die Build-Grundlagen für das Styling des Studios wurden aktualisiert.` |
| [#663](https://github.com/smart-village-solutions/sva-studio/pull/663) | 2026-07-01 15:55 | `build(deps-dev): bump tailwindcss from 4.2.4 to 4.3.2` | `Die Styling-Basis des Studios wurde technisch aktualisiert.` |
| [#662](https://github.com/smart-village-solutions/sva-studio/pull/662) | 2026-07-01 15:54 | `build(deps-dev): bump @tailwindcss/postcss from 4.3.0 to 4.3.2` | `Die technische Verarbeitung der Studio-Styles wurde aktualisiert.` |
| [#664](https://github.com/smart-village-solutions/sva-studio/pull/664) | 2026-07-01 15:54 | `build(deps-dev): bump autoprefixer from 10.5.0 to 10.5.2` | `Die Browser-Kompatibilität der Studio-Styles wurde im Hintergrund aktualisiert.` |

## Hinweise für das Backfill

- Die Liste ist bewusst nutzerorientiert formuliert, nicht commit- oder
  architekturorientiert.
- Für rein technische Dependency-PRs ist ein Sammeltext wie
  `Allgemeine Verbesserungen` sinnvoll und ausreichend.
- Vor dem tatsächlichen Anlegen der JSON-Dateien sollten die Texte kurz
  gegen die fachliche Wirkung des jeweiligen PRs geprüft werden.
