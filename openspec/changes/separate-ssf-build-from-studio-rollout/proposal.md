# Change: SSF-Build vom regulären Studio-Rollout trennen

## Why

Der zentrale `Build` baut nach dem Studio-Image auch das SSF-Image und verifiziert beide in einem gemeinsamen Gate. Dadurch verzögert oder blockiert ein SSF-Build die automatische Studio-Dev-Promotion, obwohl Kassel einen eigenen Standalone-Rollout besitzt.

## What Changes

- Der Main-Push-Build erzeugt und verifiziert nur die für den zentralen Studio-Rollout benötigten Images. Die Dev-Promotion hängt nicht mehr von einem SSF-Image ab.
- Ein eigenständiger, ausschließlich manuell auf `main` gestarteter SSF-Build erzeugt und verifiziert den unveränderlichen `sva-studio-ssf`-Digest aus dem gebundenen Quellcommit. Er deployt nicht.
- Der bestehende Kasseler Standalone-Rollout verwendet diesen geprüften Digest weiterhin erst nach gesondertem Release-Auftrag, Backup und Live-Prüfung.
- Der kontrollierte Studio-Hotfix-Nachweis wird auf seine tatsächlich im zentralen Build erzeugten Images angepasst; bisherige Nachweise bleiben für bereits gestartete Hotfix-Läufe lesbar.

## Impact

- Affected specs: `deployment-topology`
- Affected code: `.github/workflows/build.yml`, neuer manueller SSF-Build-Workflow und unmittelbar betroffene Hotfix-Evidenz/Vertragstests unter `scripts/ci/`
- Affected documentation: `docs/guides/studio-rollout-process.md`, `docs/operations/ssf-standalone-hosts.md`, `docs/architecture/07-deployment-view.md`
- Keine Änderung an `promote.yml`, `deploy/standalone/up.sh`, Kasseler Infrastruktur, Datenbanken oder SSF-Gateway/Frontend

## Abnahme

Ein Main-Push kann Studio bauen, das Studio-Image verifizieren und Dev promoten, ohne einen SSF-Build zu starten oder auf dessen Ergebnis zu warten. Der Digest eines manuell gestarteten SSF-Builds ist erst nach terminal erfolgreicher Image-Verifikation als Kassel-Kandidat zulässig; ein fehlgeschlagener Lauf liefert keinen freigegebenen Kandidaten. Ein Kasseler Rollout wird dadurch nicht automatisch ausgelöst.
