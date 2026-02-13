# ADR-[Nummer]: [Kurzer Titel]

**Status:** Proposed | Accepted | Superseded
**Entscheidungsdatum:** YYYY-MM-DD
**Entschieden durch:** [Person/Team/BDFL]
**GitHub Issue:** #XYZ
**GitHub PR:** #ABC

---

## Kontext

Beschreibe hier den Hintergrund und die Constraints, die zu dieser Entscheidung geführt haben.

**Beispiel:**
- Welches Problem existiert?
- Warum ist jetzt die richtige Zeit für diese Entscheidung?
- Welche Anforderungen/Constraints müssen erfüllt werden?
- Gibt es technische oder organisatorische Abhängigkeiten?

---

## Entscheidung

Kurze, klare Aussage, was entschieden wurde.

**Beispiel:**
"Wir verwenden React 18 mit TypeScript im strict mode als Frontend-Framework."

---

## Begründung

Warum diese spezifische Entscheidung? Welche Faktoren waren ausschlaggebend?

**Struktur:**
1. **Anforderungs-Erfüllung:** Welche Anforderungen erfüllt diese Option am besten?
2. **Team-Expertise:** Hat das Team Erfahrung damit?
3. **Ökosystem:** Sind Libraries/Tools verfügbar?
4. **Performance/Skalierbarkeit:** Wie gut skaliert es?
5. **Community/Support:** Ist es gut unterstützt?

**Beispiel:**
- ✅ Größte Community im JavaScript-Ökosystem
- ✅ 3 von 5 Entwicklern haben React-Erfahrung
- ✅ Viele A11y-Libraries verfügbar (React Query, React Hook Form)
- ✅ Gute Integration mit Nx Monorepo (React Preset)
- ✅ Performance erreichbar mit Vite + Code-Splitting

---

## Alternativen

Welche anderen Optionen wurden diskutiert und warum wurden sie verworfen?

**Format:**

### Alternative A: [Optionsname]

**Vorteile:**
- ✅ Vorteil 1
- ✅ Vorteil 2

**Nachteile:**
- ❌ Nachteil 1
- ❌ Nachteil 2 (zu schwerwiegend)

**Warum verworfen:**
[Kurze Begründung, warum diese Option nicht optimal ist]

---

### Alternative B: [Optionsname]

[Gleiche Struktur wie Alternative A]

---

## Konsequenzen

### Positive Konsequenzen
- ✅ Schnellere Entwicklung (Team-Erfahrung verfügbar)
- ✅ Reiches Ökosystem an Libraries
- ✅ Gute IDE-Unterstützung
- ✅ Etablierte Best Practices

### Negative Konsequenzen
- ❌ Größere Bundle-Size als Alternative X
- ❌ Lernkurve für Vue-Entwickler
- ❌ Mehr Boilerplate-Code nötig

### Mitigationen (wie wir die Nachteile mindern)
- Vite als Build-Tool verwenden (schneller als Webpack)
- Aggressives Code-Splitting pro Route
- Tree-Shaking konfigurieren
- Dokumentation für Lernressourcen
- Onboarding-Sessions für neue Team-Mitglieder

---

## Implementierungs-Roadmap

Konkrete Schritte zur Umsetzung dieser Entscheidung:

- [ ] Task 1: [Kurzbeschreibung] (PR #XYZ)
- [ ] Task 2: [Kurzbeschreibung] (geschätzt: 2 Tage)
- [ ] Task 3: [Kurzbeschreibung] (depends on Task 1)
- [ ] Validierung: [Wie prüfen wir, dass die Entscheidung gut war?]

---

## Verwandte ADRs

Links zu anderen ADRs, die diese Entscheidung beeinflussen oder davon abhängen:

- ADR-002: State Management (depends on this)
- ADR-003: Testing Framework (builds on this)
- ADR-XXX: [Supersedes ADR-YYY] (falls diese ADR eine ältere ersetzt)

---

## Externe Referenzen

Links zu Dokumentation, Tools, Communities, etc.:

- [React 18 Changelog](https://react.dev/blog/2022/03/29/react-v18)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Nx React Plugin](https://nx.dev/plugin-features/use-code-generators)
- Community Discord: [Link]

---

## Diskussionshistorie

- **2026-01-15:** Issue #XYZ eröffnet, erste Diskussion
- **2026-01-20:** Vote durchgeführt, entschieden
- **2026-01-22:** Implementierung begonnen
- **2026-02-05:** Review & Feedback eingearbeitet
- **2026-02-10:** Accepted nach finaler Abstimmung

---

## Gültigkeitsdauer

Diese ADR bleibt gültig, bis:
- [ ] Mindestens 6 Monate in Produktion
- [ ] Ein besserer Ansatz gefunden wird
- [ ] Anforderungen sich fundamental ändern

**Nächste Überprüfung:** YYYY-MM-DD (z.B. 1 Jahr nach Entscheidungsdatum; danach regelmäßig, z.B. 1x pro Jahr)

---

## Template-Notizen

**Tipps zum Ausfüllen dieses Templates:**

1. **Sei präzise:** Kurze, klare Aussagen (nicht > 500 Wörter pro Sektion)
2. **Begründe alles:** Nicht einfach behaupten, warum etwas besser ist
3. **Sei fair zu Alternativen:** Gib nicht von Anfang an nur Nachteile an
4. **Denk voraus:** Was sind langfristige Konsequenzen?
5. **Dokumentiere Dissent:** Wenn nicht alle einverstanden sind, notiere die Gegenpositionen
6. **Aktualisiere bei Änderungen:** Wenn sich etwas fundamental ändert, aktualisiere die ADR

---

## Status-Legende

| Status | Bedeutung |
|---|---|
| **Proposed** | Unter Diskussion, Abstimmung ausstehend |
| **Accepted** | Entschieden, Implementierung läuft oder ist geplant |
| **Superseded** | Durch neuere ADR ersetzt (Link zu neuerer ADR) |
| **Deprecated** | Nicht mehr relevant, aber historisch interessant |

---

Vorlage basiert auf [Architecture Decision Records (ADRs)](https://adr.github.io/) und [MADR](https://adr.github.io/madr/).
