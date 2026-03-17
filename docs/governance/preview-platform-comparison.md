# Vergleichsmatrix Preview-Plattform: Vercel vs. Eigene Infrastruktur

## Ziel und Geltungsbereich

Dieses Dokument definiert eine reproduzierbare Entscheidungssystematik für Preview-Umgebungen im Branch- und PR-Workflow von SVA Studio. Verglichen werden:

- Vercel (managed Preview Deployments)
- Eigene Infrastruktur (self-hosted, z. B. auf VM/Kubernetes mit eigener CI/CD-Steuerung)

Die Matrix ist bewusst plattformneutral: Sie liefert eine nachvollziehbare Bewertungslogik, legt aber keine finale Plattform für alle Fälle fest.

## Kontext aus dem aktuellen Repository

- Das Preview-Target ist bereits vorhanden: `nx run sva-studio-react:preview` (`apps/sva-studio-react/project.json`).
- Die App nutzt `vite preview` als technische Basis (`apps/sva-studio-react/package.json`).
- Die produktive Zieltopologie ist aktuell noch nicht verbindlich festgelegt (`docs/architecture/07-deployment-view.md`).

## Bewertungsmodell (maschinenprüfbar)

### Skala und Gewichtung

- Skala pro Kriterium: `1` bis `5`.
  - `1`: unzureichend
  - `2`: schwach
  - `3`: ausreichend
  - `4`: gut
  - `5`: sehr gut
- Gewichte sind in Prozent angegeben und summieren sich zu `100`.
- Formel pro Kriterium: `gewichtete_punkte = gewicht_prozent * score`.
- Gesamtscore: `summe(gewichtete_punkte)`.

### Kriterienmatrix

| Kriterium | Gewicht (%) | Scoring-Methode (1-5) | Vercel | Eigene Infrastruktur |
| --- | ---: | --- | ---: | ---: |
| Setup-Geschwindigkeit | 15 | Zeit bis erstes reproduzierbares PR-Preview (inkl. DNS/Secrets/CI): `< 1 Tag = 5`, `1-2 Tage = 4`, `3-5 Tage = 3`, `6-10 Tage = 2`, `> 10 Tage = 1` | 5 | 2 |
| Developer Experience (DX) | 15 | Preview-URL-Verfügbarkeit pro PR, Feedback-Latenz, lokaler/CI-Konfigurationsaufwand: vollautomatisch und konsistent = 5, manuell/brüchig = 1 | 5 | 3 |
| Isolation | 15 | Grad der Trennung zwischen Branch/PR-Umgebungen (Netz, Daten, Secrets, Laufzeit): starke Isolation = 5, geringe Isolation = 1 | 4 | 5 |
| Security | 20 | Abdeckung von Secret-Handling, Zugriffsschutz, Auditierbarkeit, Policy-Enforcement: hohe Abdeckung mit wenig Lücken = 5 | 4 | 5 |
| SLA/Verfügbarkeit | 10 | Erwartbare Verfügbarkeit des Preview-Betriebs inkl. Failover/Betriebsreife: klar abgesichert und stabil = 5, ad hoc/instabil = 1 | 4 | 3 |
| Kosten | 15 | Erwartete TCO für Preview-Betrieb (direkte Plattformkosten + Engineering-/Betriebsaufwand): niedrig und planbar = 5, hoch/volatil = 1 | 3 | 4 |
| Betrieb (Ops Burden) | 10 | Operativer Aufwand fuer Monitoring, Patching, Incident-Handling, Lifecycle-Cleanup: minimal = 5, hoch = 1 | 5 | 2 |

### Berechnung mit den obigen Basiswerten

| Kriterium | Gewicht (%) | Vercel Score | Vercel gewichtete Punkte | Eigene Infrastruktur Score | Eigene Infrastruktur gewichtete Punkte |
| --- | ---: | ---: | ---: | ---: | ---: |
| Setup-Geschwindigkeit | 15 | 5 | 75 | 2 | 30 |
| Developer Experience (DX) | 15 | 5 | 75 | 3 | 45 |
| Isolation | 15 | 4 | 60 | 5 | 75 |
| Security | 20 | 4 | 80 | 5 | 100 |
| SLA/Verfügbarkeit | 10 | 4 | 40 | 3 | 30 |
| Kosten | 15 | 3 | 45 | 4 | 60 |
| Betrieb (Ops Burden) | 10 | 5 | 50 | 2 | 20 |
| **Summe** | **100** |  | **425** |  | **360** |

Hinweis: Die Basiswerte sind ein Referenzprofil für den aktuellen Reifegrad. Für eine konkrete Entscheidung müssen Scores projektspezifisch neu gesetzt und mit denselben Kriterien erneut berechnet werden.

## Entscheidungspfad

### Wann Vercel nutzen

Vercel ist die bevorzugte Option, wenn mindestens eine der folgenden Bedingungen zutrifft:

- Setup-Geschwindigkeit ist kritisch (`gewicht >= 15`) und Ziel ist produktives PR-Preview in <= 2 Tagen.
- Teamkapazität für Plattformbetrieb ist begrenzt und `Betrieb (Ops Burden)` hat einen hohen Stellenwert.
- Hohe DX-Anforderung für viele parallele PRs mit sofortigen, stabilen Preview-URLs.

### Wann Eigene Infrastruktur nutzen

Eigene Infrastruktur ist die bevorzugte Option, wenn mindestens eine der folgenden Bedingungen zutrifft:

- Sicherheits- und Isolationsanforderungen dominieren (`Security + Isolation >= 35` Gewicht) und erfordern tiefe technische Kontrolle.
- Regulatorik/Compliance verlangt vollständige Hoheit über Laufzeit, Netzwerksegmentierung und Betriebsdaten.
- Kostenmodell profitiert bei hoher Last oder langfristigem Betrieb von vorhandener Plattformkompetenz.

## Tie-Breaker-Regel (deterministisch)

Falls beide Optionen denselben Gesamtscore haben, gilt strikt folgende Reihenfolge:

1. Höherer `Security`-Score gewinnt.
2. Bei erneutem Gleichstand gewinnt höherer `Isolation`-Score.
3. Bei erneutem Gleichstand gewinnt höherer `Kosten`-Score.
4. Bei erneutem Gleichstand gewinnt höherer `Setup-Geschwindigkeit`-Score.
5. Bei vollständiger Gleichheit nach 1-4 gilt Default: **Vercel für Pilotphase bis 90 Tage**, danach Re-Scoring mit realen Betriebsdaten.

Damit bleibt die Entscheidung auch im Edge Case reproduzierbar und ohne ad-hoc Einzelfallentscheidung.

## Anwendungsregel

- Die Matrix ist vor T7/T8/T9/T11 als Eingangsartefakt zu verwenden.
- Bewertung und Umsetzung bleiben getrennt: Dieses Dokument beschreibt nur Entscheidungslogik, keine Migrations- oder Implementierungsschritte.
