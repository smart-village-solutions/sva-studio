# i18n-Key-Konventionen für Account-UI

## Ziel

Diese Konventionen definieren die Struktur für Übersetzungs-Keys in der Account- und Admin-UI.
Die Struktur ist verpflichtend, damit Keys konsistent, auffindbar und typisierbar bleiben.

## Namensschema

Alle Keys folgen dem Schema:

`<bereich>.<seite>.<element>`

- `bereich`: funktionaler Bereich (`account`, `admin.users`, `admin.roles`)
- `seite`: logische Untersektion der Seite (`page`, `table`, `actions`, `filters`, `messages`, `labels`, `fields`)
- `element`: konkreter UI-Text (`title`, `headerName`, `save`, `emptyState`)

## Beispiele

- `account.profile.title`
- `account.fields.phone`
- `account.messages.keycloakRedirectHint`
- `admin.users.table.headerName`
- `admin.users.filters.searchPlaceholder`
- `admin.roles.labels.systemRole`

## Sprachabdeckung

Für jeden Key muss ein Eintrag in **DE** und **EN** vorhanden sein.
Die Locale-Parität wird automatisiert geprüft.

## Technische Ablage

Die Ressourcen liegen in:

- `apps/sva-studio-react/src/i18n/resources.ts`

Die typisierte Übersetzungsfunktion liegt in:

- `apps/sva-studio-react/src/i18n/translate.ts`

## Build-Check

Fehlende Keys in `t('...')`-Aufrufen und fehlende Locale-Einträge führen zu einem Build-Fehler.
Der Check läuft über:

- `scripts/ci/check-i18n-keys.ts`
- `apps/sva-studio-react/package.json` → `check:i18n` / `build`
