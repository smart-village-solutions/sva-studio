# ADR-008: Layout-Shell mit Skeleton-Bereichen (Sidebar, Kopfzeile, Content)

**Datum:** 25. Februar 2026
**Status:** ✅ Accepted
**Kontext:** UI-Architektur, Erweiterbarkeit, A11y und Responsivität
**Entscheider:** SVA Studio Team

---

## Entscheidung

Für `apps/sva-studio-react` wird eine dedizierte Layout-Shell eingeführt, die die drei Kernbereiche klar trennt:

- Sidebar
- Kopfzeile
- Contentbereich

Zusätzlich wird eine wiederverwendbare Skeleton-Darstellung für alle drei Bereiche implementiert. Die Shell wird im Root-Layout verankert und als Standard-Grundstruktur für kommende UI-Erweiterungen genutzt.

---

## Kontext und Problem

Die bestehende App-Struktur bietet bereits Header und Content, aber keine klar gekapselte Shell mit Sidebar als eigenständigem Baustein. Für zukünftige Erweiterungen (z. B. zusätzliche Navigation, plugin-spezifische Einstiege, kontextuelle Header-Aktionen) sind getrennte, kompositionsfähige Bereiche notwendig.

Darüber hinaus fehlen konsistente Skeleton-Zustände auf Shell-Ebene. Das führt bei Ladezuständen zu uneinheitlicher Wahrnehmung und erschwert eine skalierbare UX-Strategie.

---

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
|---|---|---|---|
| **A: Dedizierte Shell + bereichsbezogene Skeletons (empfohlen)** | Erweiterbarkeit, Konsistenz, A11y | 9/10 | Klare Trennung, gute Basis für Wachstum ✅ |
| B: Nur punktuelle Skeletons in Einzelkomponenten | Umsetzungsaufwand | 6/10 | Schnell, aber uneinheitlich und schlechter erweiterbar |
| C: Kein Shell-Umbau, nur visuelle Optimierung | Kurzfristige Einfachheit | 4/10 | Architekturproblem bleibt bestehen |

### Warum Option A?

- ✅ Trennung von Struktur und Seiteninhalt verbessert Wartbarkeit
- ✅ Einheitliche Ladezustände für zentrale Bereiche
- ✅ Saubere Basis für Responsivität (mobile-first)
- ✅ A11y-Baseline über semantische Landmarks und Skip-Link

---

## Trade-offs & Limitierungen

### Pros
- ✅ Bessere Erweiterbarkeit für neue Navigations-/Header-Anforderungen
- ✅ Konsistente Nutzerführung bei Ladezuständen
- ✅ Verbesserte Testbarkeit durch klar getrennte Bausteine

### Cons
- ❌ Höhere initiale Strukturkomplexität
- ❌ Zusätzlicher Pflegeaufwand für Shell- und Skeleton-Komponenten

**Mitigation:** Schlanke, fokussierte Komponenten mit minimalen, stabilen Props und klarer Verantwortungsgrenze.

---

## Implementierung / Ausblick

- [x] Shell-Komposition in Root-Route integriert
- [x] Sidebar-Komponente als eigener Baustein eingeführt
- [x] Skeleton-Zustände für Header, Sidebar und Content implementiert
- [x] Skip-Link und Landmarks ergänzt
- [x] Unit-Tests für Shell-/Header-Verhalten ergänzt
- [ ] i18n-Harmonisierung für alle neuen/alten UI-Texte nachziehen

---

## Migration / Exit-Strategie

Die Entscheidung ist rückbaubar: Falls sich die Shell-Architektur ändert, können Sidebar/Header/Content als getrennte Komponenten erhalten und in eine neue Komposition überführt werden. Ein Supersede erfolgt über eine nachfolgende ADR.

---

**Links:**
- `openspec/changes/add-skeleton-layout-shell/proposal.md`
- `openspec/changes/add-skeleton-layout-shell/design.md`
