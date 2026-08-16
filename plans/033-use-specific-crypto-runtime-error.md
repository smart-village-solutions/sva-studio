# Plan 033: Fehlenden Web-Crypto-Runtime-Vertrag spezifisch typisieren

> **Executor**: Arbeite ausschließlich im angegebenen Scope. Führe Baseline und neue Characterization zuerst gegen den Altcode aus. STOP-Bedingungen haben Vorrang vor Improvisation.

## Status

- **Priorität**: P0
- **Aufwand**: XS
- **Risiko**: niedrig
- **Abhängigkeit**: Plan 027 und dessen Main-Sonar-Scan
- **Kategorie**: Reliability / Security-Vertrag
- **Geplant auf**: `c589cf958`, 15. August 2026
- **Sonar**: `AaAHHfjRRXPx87p88P3F`, `typescript:S7786`, MINOR/Code Smell
- **Ausgeliefert**: PR #1020, Merge-Commit `46fa0343a2bb461ea189ba8c508fa25d649f57fd`

## Warum das wichtig ist

Der Main-Sonar-Scan nach Plan 027 bestätigte die beseitigte Vulnerability und
das grüne Quality Gate, meldete aber im neuen fail-closed Web-Crypto-Zweig einen
unspezifischen `Error`. Das Fehlen der benötigten Runtime-Funktion ist ein
konkreter Typfehler. Eine spezifische Fehlerklasse hält den Vertrag für
Konsumenten und Diagnostik präzise, ohne den sicheren Abbruch abzuschwächen.

## Aktueller Zustand bei Planung

- `packages/studio-ui-react/src/content-media-usage.ts:29` wirft bei fehlendem
  `globalThis.crypto.randomUUID` einen generischen `Error`.
- Der Runtime-Vertrag, die Fehlermeldung und das Ausbleiben eines schwachen
  Zufalls-Fallbacks sind bereits durch Plan 027 charakterisiert.
- Workspace: `studio-ui-react`.

## Scope

**In Scope**: die konkrete Fehlerklasse im fail-closed Zweig, die vorhandene
Characterization und der Changelog-Eintrag.

**Out of Scope**: neue Crypto-Polyfills, Fallback-IDs, persistierte Media-IDs,
Fehlermeldung, Catch-/Retry-Logik, Sonar-Suppression oder Quality-Profile.

## Schritte und Characterization

1. Bestehende fokussierte Baseline ausführen.
2. Vor der Source-Änderung einen Test ergänzen, der die spezifische Fehlerklasse
   sowie die unveränderte Meldung fordert; der Klassen-Test muss gegen den
   Altcode gezielt rot sein.
3. Ausschließlich `Error` durch `TypeError` ersetzen.
4. Fokussierte Unit-Tests, Types, Lint, Build, Complexity, OpenSpec strict,
   File Placement, Changelog, `git diff --check` und den Fallow-New-only-Audit
   für `studio-ui-react` ausführen.

## Erwartete Wirkung

- Sonar: S7786 1→0 nach dem nächsten Main-Scan.
- Verhalten: weiterhin deterministischer fail-closed Abbruch mit identischer
  Meldung; kein Fallback und keine Persistenzwirkung.
- Fallow: PASS, alle eingeführten Finding-Zähler null.

## STOP-Bedingungen

- Ein Konsument unterscheidet nachweislich den generischen `Error` von
  `TypeError` und würde dadurch seine sichere Fehlerbehandlung verlieren.
- Der Fix erfordert einen Crypto-Polyfill, eine neue Fallback-Strategie oder
  eine Änderung persistierter IDs.
- Baseline rot oder aktive Source-/Vertragsüberschneidung.

## Abnahme

Die neue Characterization war gegen den Altcode gezielt rot und danach 5/5
grün. Fallow meldete PASS und in allen eingeführten Kategorien null. Root- und
unabhängiges Review gaben den exakten, diff-identischen Final-HEAD frei; die CI
war mit null fehlerhaften und null ausstehenden Checks sowie null offenen
Threads terminal grün.
