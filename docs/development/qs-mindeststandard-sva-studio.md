# QS-Mindeststandard für SVA Studio

## Ziel

Dieses Dokument definiert den kleinsten verbindlichen QS-Standard für das Repository. Es soll mit vertretbarem Aufwand sicherstellen, dass Änderungen nachvollziehbar, risikoorientiert getestet und für Reviewer schnell einordenbar sind.

Der Mindeststandard ergänzt bestehende Quality Gates. Er ersetzt weder `./testing-strategy.md` noch `../governance/merge-review-gates.md`.

## Pflicht pro Änderung

Jede Änderung mit funktionaler, technischer oder betrieblicher Wirkung muss im PR mindestens die folgenden Fragen beantworten:

- Welche Anforderung, welches Problem oder welches Ziel wird adressiert?
- Welche Projekte oder Packages sind konkret betroffen?
- Welche Risiken entstehen durch die Änderung?
- Welche Tests oder Nachweise wurden für den betroffenen Scope ausgeführt?
- Welche Dokumentation wurde aktualisiert oder warum war keine Doku-Anpassung nötig?

Reine Formatierungs- oder Doku-Änderungen dürfen knapper dokumentiert werden, müssen aber weiterhin klar beschreiben, was geändert wurde.

## Risikoklassen

Die Testtiefe richtet sich nach dem Risiko der betroffenen Änderung, nicht nach einem pauschalen Standard für alle Projekte.

| Risikoklasse | Typische Projekte | Erwartung |
| --- | --- | --- |
| hoch | `sva-mainserver`, `auth-runtime`, `iam-admin`, `iam-core`, `iam-governance`, `instance-registry`, `data`, `routing` | klare PR-Risikoanalyse, zielgerichtete Unit-/Type-/Integrationsnachweise, bei Flow-Wirkung zusätzlich E2E- oder Smoke-Nachweis |
| mittel | `data-client`, `monitoring-client`, `plugin-sdk`, `server-runtime`, `studio-module-iam` | fachlich passende Unit-/Type-Tests, Integrationsnachweis wenn Verträge, Runtime oder Schnittstellen betroffen sind |
| normal | `studio-ui-react`, Fachplugins ohne Sicherheits- oder Betriebswirkung, reine Doku-/Governance-Dateien | gezielte Nachweise für den betroffenen Pfad; bei UI-Änderungen mindestens semantische und Accessibility-Prüfung |

Wenn eine Änderung mehrere Klassen berührt, gilt die höchste Risikoklasse.

## Mindestnachweise nach Änderungstyp

| Änderungstyp | Mindestnachweis |
| --- | --- |
| Doku oder Governance ohne Laufzeitwirkung | `pnpm check:file-placement` und inhaltliche Reviewbarkeit |
| Kernlogik oder Vertragsänderung | `pnpm test:types`, betroffene Unit-Tests, bei Bedarf `pnpm check:server-runtime` |
| Datenzugriff, Auth, IAM, Routing, Server-Settings | betroffene Unit- und Type-Tests plus Integrations- oder Flow-Nachweis |
| UI, Formulare, Navigation, Dialoge | betroffene Tests plus Accessibility-Selbstprüfung für Semantik, Labels, Tastaturbedienung und Fokus |
| Release-, Rollout- oder Betriebslogik | passende technische Nachweise, aktualisierte Betriebsdoku und klare Rollback-Aussage |

## Accessibility-Mindeststandard

Für neue oder geänderte UI gilt mindestens:

- keine neuen hardcodierten user-facing Texte
- semantisch passende HTML-/UI-Struktur
- bedienbar per Tastatur, soweit interaktiv
- erkennbare Labels, Namen und Fokus-Zustände
- keine bewusst eingeführte Verschlechterung gegen WCAG-/BITV-Grundanforderungen

Ein vollständiges Audit ist nicht für jede kleine Änderung erforderlich. Die Auswirkungen müssen aber im PR aktiv geprüft werden.

## Testdaten-Mindeststandard

- Es werden keine echten personenbezogenen Daten in Tests, Fixtures, Seeds, Snapshots oder Debug-Artefakten abgelegt.
- Testdaten sind synthetisch, anonymisiert oder hinreichend pseudonymisiert.
- Bei Datenexporten, Logs und Screenshots ist auf PII-Schutz zu achten.

## Review-Erwartung

Reviewer prüfen nicht nur, ob CI grün ist, sondern ob die Änderung inhaltlich rückverfolgbar und zum Risiko passend abgesichert ist.

Mindestens zu prüfen sind:

- Problem und Ziel der Änderung sind verständlich beschrieben.
- Betroffene Projekte oder Packages sind explizit benannt.
- Risiko und Rollback sind für risikoreiche Änderungen nachvollziehbar.
- Testnachweise passen zur Risikoklasse.
- Relevante Doku wurde aktualisiert.

## Verweise

- Teststrategie: `./testing-strategy.md`
- Merge- und Review-Gates: `../governance/merge-review-gates.md`
- Architektur, Qualitätsziele: `../architecture/10-quality-requirements.md`
