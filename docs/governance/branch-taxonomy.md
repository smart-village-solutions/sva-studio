# Branch-Taxonomie und Namensmodell

## Ziel und Geltungsbereich

Dieses Dokument definiert das finale Branch-Namensmodell für die tägliche Entwicklung auf Basis von Trunk + Stacked PRs. Neue Arbeits-Branches verwenden ausschließlich diese Klassen:

- `feature/`
- `fix/`
- `chore/`
- `stack/`
- `epic/`

Es gibt keine unbefristeten Integrations-Branches außer `main`.

## Einheitliches Namensmuster

Alle Klassen verwenden dasselbe Namensmuster:

- Format: `<klasse>/<kebab-case-beschreibung>`
- Regex (final, Policy): `^(feature|fix|chore|stack|epic)/[a-z0-9]+(-[a-z0-9]+)*$`
- Zeichenregeln (Policy): nur Kleinbuchstaben `a-z`, Ziffern `0-9` und Bindestrich `-`
- Verbote (Policy): Leerzeichen, Umlaute im Branch-Namen, Unterstriche, doppelte Slash-Segmente sowie Backticks `` ` `` und einfache/doppelte Anführungszeichen `'` / `"`

## Klassen, Verwendung und TTL

### `feature/`

- Zweck: Neue fachliche Funktionalität mit produktrelevantem Mehrwert
- Basisbranch: `main` (oder bei Stacking der direkte Vorgänger-Branch)
- **TTL (hart): max. 7 Kalendertage ab Branch-Erstellung**
- **TTL-Verhalten:**
  - Tag 5: Review-Status prüfen und ggf. rebasen/splitten
  - Tag 7: Branch muss gemerged, retargetet oder geschlossen werden

**Gültige Beispiele:**
- `feature/user-profile-editor`
- `feature/plugin-route-guards`

**Ungültige Beispiele:**
- `feature/User-Profile` (Großbuchstaben)

### `fix/`

- Zweck: Fehlerbehebungen mit klarer Ursache/Wirkung
- Basisbranch: `main` (oder direkter Stack-Vorgänger)
- **TTL (hart): max. 3 Kalendertage ab Branch-Erstellung**
- **TTL-Verhalten:**
  - Tag 2: Status prüfen und offene Blocker beseitigen
  - Tag 3: Branch muss gemerged oder geschlossen werden

**Gültige Beispiele:**
- `fix/session-timeout-race`
- `fix/redis-ttl-rounding`

**Ungültige Beispiele:**
- `fix/` (fehlende Beschreibung)

### `chore/`

- Zweck: Wartung, Build/Tooling, Refactoring ohne direktes Feature-Verhalten
- Basisbranch: `main` (oder direkter Stack-Vorgänger)
- **TTL (hart): max. 7 Kalendertage ab Branch-Erstellung**
- **TTL-Verhalten:**
  - Tag 5: Scope prüfen und bei Bedarf weiter aufteilen
  - Tag 7: Branch muss gemerged, retargetet oder geschlossen werden

**Gültige Beispiele:**
- `chore/update-nx-cache-keys`
- `chore/cleanup-unused-fixtures`

**Ungültige Beispiele:**
- `chore/update_nx_cache_keys` (Unterstrich)

### `stack/`

- Zweck: Technischer Zwischenbranch für gestapelte PR-Ketten (abhängige Inkremente)
- Basisbranch: immer ein konkreter Vorgänger-Branch, niemals ein Dauer-Integrationszweig
- **TTL (hart): max. 7 Kalendertage ab Branch-Erstellung**
- **TTL-Verhalten:**
  - Tag 5: Pflicht zur Synchronisierung (Rebase/Merge vom Upstream)
  - Tag 7: Branch muss gemerged oder geschlossen werden

**Gültige Beispiele:**
- `stack/editor-shell-foundation`
- `stack/auth-flow-step-2`

**Ungültige Beispiele:**
- `stack/long-running-integration-branch` (verbotener Dauer-Integrationszweck)

### `epic/`

- Zweck: Zeitlich begrenzter Dachbranch für ein größeres Vorhaben mit mehreren untergeordneten Branches
- Basisbranch: `main`
- **TTL (hart): max. 14 Kalendertage ab Branch-Erstellung**
- **TTL-Verhalten:**
  - Tag 10: obligatorischer Status- und Schnittreview
  - Tag 14: Epic wird aufgelöst (gemerged oder in kleinere Branches aufgeteilt)

**Gültige Beispiele:**
- `epic/plugin-system-rollout`
- `epic/workspace-onboarding-redesign`

**Ungültige Beispiele:**
- `epic/q1-platform-program` (TTL-Verletzungsrisiko durch langfristigen Programmcharakter)

## Hook-Abgleich und Migration

Aktueller Hook-Stand (`.githooks/reference-transaction:14-15`):

- Erlaubte Prefixes derzeit: `feature|fix|chore|docs|setup|adr|hotfix|epic|release|refactor|dev`
- Erlaubtes Zeichenset im Hook ist aktuell weiter gefasst als die finale Policy und akzeptiert zusaetzlich Backticks und doppelte Anfuehrungszeichen.
- Damit sind `feature/`, `fix/`, `chore/`, `epic/` bereits validierbar.
- `stack/` ist im Hook noch nicht freigeschaltet.

Migrationsregel bis Hook-Anpassung:

- Diese Taxonomie ist das Zielmodell für neue Branches.
- Für vollständige technische Durchsetzung muss `stack` in die Hook-Prefixliste aufgenommen werden.
- Fuer vollständige Zeichensatz-Durchsetzung muss der Hook zudem auf das finale Policy-Regex verengt werden.
- Bis zur Hook-Migration sind `stack/*`-Branches Governance-konform, werden lokal aber erst nach Hook-Update strikt validiert.

## QA-Kriterien

- Prefix-Abgleich erfolgt über Evidenzdatei `./.sisyphus/evidence/task-2-qa-prefix-alignment.txt`.
- Invalid-Beispiele-Pruefung erfolgt ueber Evidenzdatei `./.sisyphus/evidence/task-2-qa-invalid-examples.txt`.
