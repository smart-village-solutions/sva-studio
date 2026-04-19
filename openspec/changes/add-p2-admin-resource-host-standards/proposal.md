# Change: Host-Standards für Suche, Filter, Bulk-Actions und Revisionen im Admin definieren

## Why

Ein CMS-Admin skaliert schlecht, wenn jedes Fachpackage Suche, Filter, Bulk-Actions, Historie und Revisionen neu erfindet. Das Studio braucht dafür hostseitige Standards, die von Packages nur konfiguriert und nicht jeweils neu gebaut werden.

## What Changes

- Definition kanonischer Host-Fähigkeiten für Suche, Filter, Bulk-Actions, Historie und Revisionen in Admin-Ressourcen
- Klärung, welche Teile dieser Funktionen hostgeführt und welche pluginseitig konfigurierbar sind
- Vereinheitlichung der Erwartungen an Listen- und Detailseiten im Admin
- Vorbereitung wiederverwendbarer Standards für neue Content- und Verwaltungsressourcen
- Ausrichtung des Admin-Backbones auf CMS-typische Querschnittsfähigkeiten statt auf einzelne Sonderflächen

## Impact

- Affected specs:
  - `account-ui`
  - `content-management`
  - `iam-auditing`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin`
  - `packages/sdk`
  - `packages/auth`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
