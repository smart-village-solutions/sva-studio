# Verifikation: Strukturierte Permissions und Hierarchie-Vererbung

## Stand

Verifiziert am 2026-03-09 auf Branch `feature/add-iam-permission-inheritance-engine`.

## Umgesetzter Scope

- Strukturierte Permission-Felder in `iam.permissions`
- Rückwärtskompatibler Migrationspfad vom bestehenden `permission_key`
- Seed-Anpassungen für Basis-Permissions
- Autorisierungslogik für `allow`/`deny`, `resource_id` und org-bezogene Parent-Vererbung
- Deduplizierte effektive Permissions mit `effect` und `scope`

## Ausgeführte Verifikation

```bash
pnpm nx run data:test:unit
pnpm nx run core:test:unit
pnpm nx run auth:test:unit
pnpm exec tsc -p tsconfig.scripts.json --noEmit
pnpm nx run data:db:migrate:validate
pnpm nx run data:db:test:seeds
openspec validate add-iam-permission-inheritance-engine --strict
```

## Ergebnis

- Alle oben genannten Läufe waren grün.
- `data:db:test:seeds` prüft zusätzlich die neuen strukturierten Permission-Felder (`action`, `effect`, `scope`) auf idempotente Seedbarkeit.
- `core`- und `auth`-Tests decken neue Konfliktpfade für `deny` vor `allow`, Resource-Spezifität und Org-Hierarchie ab.

## Bekannte Restarbeiten

- Snapshot-Key noch nicht um Geo-Kontext und weitere Versionssignale erweitert
- Invalidation noch nicht explizit auf Permission-/Hierarchy-Mutationen ausgebaut
- Separater Performance-Nachweis für Cache-Hit und Cache-Miss noch offen
