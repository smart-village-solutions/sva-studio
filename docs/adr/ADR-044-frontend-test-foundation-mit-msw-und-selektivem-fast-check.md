# ADR-044: Frontend-Test-Foundation mit MSW und selektivem fast-check

**Datum:** 2026-05-22
**Status:** ✅ Accepted
**Kontext:** Frontend-Teststrategie und kritische Kernlogik
**Entscheider:** Studio-Architektur und Test-Governance

---

## Entscheidung

HTTP-nahe Frontend-Tests verwenden im Standardpfad `msw`. Für kritische framework-agnostische Kernlogik wird `fast-check` selektiv und hotspot-basiert eingesetzt. Modul-Mocks bleiben nur für rein lokale Logik ohne HTTP-Bezug zulässig.

## Kontext und Problem

Die bestehende Testlandschaft mischt HTTP-nahe Tests mit Modul-Mocks, Hook-Stubs und lokalen Hilfskonstrukten. Damit lassen sich Request-Reihenfolgen, Fehlerantworten und Ladezustände oft nur indirekt prüfen. Gleichzeitig wäre ein pauschaler Einsatz von Property-based-Tests für jede Komponente unverhältnismäßig.

Benötigt wird deshalb ein zweigeteilter Standard:

- `msw` als verbindliche Mocking-Schicht für beobachtbares HTTP-Verhalten unterhalb echter E2E- und Infra-Läufe
- `fast-check` als selektives Werkzeug für Hotspots mit Invarianten und großen Eingaberäumen

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
| --- | --- | --- | --- |
| **`msw` für HTTP-nahe Tests plus selektives `fast-check`** | Realitätsnähe, Wartbarkeit, Fokus, Reviewbarkeit | 9/10 | Trennt HTTP-Verhalten sauber von lokaler Logik und verhindert gleichzeitig Property-based-Overuse. |
| Reine Modul-Mocks auch für HTTP-Pfade | Einfachheit, Geschwindigkeit | 4/10 | Verdeckt Netzverhalten und koppelt Tests stark an Implementierungsdetails. |
| `fast-check` pauschal für breite Frontend-Suites | Gründlichkeit, Vollständigkeit | 5/10 | Hoher Aufwand ohne proportionalen Nutzen für UI-nahe Tests; Fokus auf Hotspots ist sinnvoller. |

### Warum die gewählte Option?

- ✅ `msw` beschreibt HTTP-Verhalten näher am echten Vertrag als modulinterne Stubs.
- ✅ Selektives `fast-check` richtet Review-Aufwand auf die wenigen Logiken mit echter Invariantenlast.
- ✅ Die Kombination passt zu Nx-Slices, Monorepo-Testinfrastruktur und bestehenden Coverage-/Qualitätsgates.

## Trade-offs & Limitierungen

### Pros

- ✅ Stabilere und aussagekräftigere Frontend-Tests für Lade-, Fehler- und Mutationspfade
- ✅ Klare Abgrenzung zwischen HTTP-Verhalten, lokaler Logik und echten E2E-Läufen
- ✅ Property-based-Tests dort, wo sie fachlich wirklich Mehrwert bringen

### Cons

- ❌ `msw` ersetzt keine echten E2E- oder Integrationsläufe gegen reale Infrastruktur.
- ❌ Die Hotspot-Prüfung für `fast-check` erfordert disziplinierte Review-Arbeit und saubere Begründungen.

## Implementierung / Ausblick

- [x] Governance-Regeln für `msw`, Modul-Mocks und `fast-check`-Review in `docs/development/studio-foundations-governance.md` dokumentieren
- [x] Initiale `fast-check`-Hotspots in der Governance-Doku benennen
- [ ] Gemeinsames `msw`-Setup in `tooling/testing` und Referenzmigrationen in betroffenen Frontend-Suites durchziehen

## Migration / Exit-Strategie

Bestehende Tests dürfen als Legacy bestehen bleiben, solange sie nicht grundlegend überarbeitet werden. Bei jeder neuen HTTP-nahen Testanlage oder tiefen Überarbeitung gilt `msw` als Pflichtpfad. Falls ein Hotspot sich später als unkritisch herausstellt, kann `fast-check` dort reduziert werden, die Entscheidung muss aber weiterhin explizit im Review begründet sein.

---

**Links:**
- [Studio-Foundations-Governance](../development/studio-foundations-governance.md)
- [Testing-Strategie](../development/testing-strategy.md)
- [Testing & Coverage Governance](../development/testing-coverage.md)
- [08 Querschnittliche Konzepte](../architecture/08-cross-cutting-concepts.md)
- [10 Qualitätsanforderungen](../architecture/10-quality-requirements.md)
