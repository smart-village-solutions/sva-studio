# i18n-Abdeckung für Account- und Admin-UI

## Ziel

Nachweis, dass die Schlüsselräume `account.*`, `admin.users.*` und `admin.roles.*` vollständig in DE/EN vorhanden und im Build prüfbar sind.

## Schlüsselräume

- `account.*`
- `admin.users.*`
- `admin.roles.*`

## Technische Prüfschritte

1. Locale-Parität prüfen (DE/EN):

```bash
pnpm --filter sva-studio-react run check:i18n
```

2. Build mit i18n-Checks:

```bash
pnpm nx run sva-studio-react:build
```

Der Check schlägt fehl bei:

- fehlenden Schlüsseln in einer Locale
- zusätzlichen, nicht referenzierten Locale-Schlüsseln
- `t('...')`-Nutzung ohne Key in `resources.ts`

## Ablage

- Ressourcen: `apps/sva-studio-react/src/i18n/resources.ts`
- Übersetzer: `apps/sva-studio-react/src/i18n/translate.ts`
- CI-Check: `scripts/ci/check-i18n-keys.ts`

## Ergänzende Konventionen

- Namensschema: `<bereich>.<seite>.<element>`
- Konventionen: `docs/guides/i18n-key-konventionen-account-ui.md`
