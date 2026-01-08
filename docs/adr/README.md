# Architecture Decision Records (ADRs)

Zentrale Dokumentation aller technischen und architektonischen Entscheidungen im SVA Studio Projekt.

## Was sind ADRs?

Architecture Decision Records dokumentieren **wichtige technische Entscheidungen**, die langfristige Auswirkungen auf das Projekt haben. Sie speichern:

- **Kontext:** Warum musste eine Entscheidung getroffen werden?
- **Entscheidung:** Was wurde entschieden?
- **Begründung:** Warum diese Option?
- **Konsequenzen:** Welche positiven und negativen Folgen hat das?
- **Alternativen:** Welche anderen Optionen wurden erwogen?

### Warum ADRs wichtig sind

- 📚 **Wissenserhalt:** Neuen Team-Mitgliedern das "Warum" erklären
- 🧠 **Kontext-Bewahrung:** In 6 Monaten erinnert sich niemand, warum React gewählt wurde
- 🤝 **Transparenz:** Community sieht, wie Entscheidungen getroffen werden
- 🔄 **Rückverfolgung:** Wenn etwas schiefgeht, können wir nachsehen, was übersehen wurde
- 📋 **Governance:** Open-Source-Projekte profitieren von dokumentierten Entscheidungen

---

## Übersicht aller ADRs

### Status-Legende

| Symbol | Bedeutung |
|---|---|
| ✅ | Accepted – Aktuelle, gültige Entscheidung |
| 📋 | Proposed – Unter Diskussion, Abstimmung ausstehend |
| 🔄 | Superseded – Durch neuere ADR ersetzt |
| ❌ | Deprecated – Nicht mehr relevant |

---

### ADR-Liste

| # | Titel | Status | Entscheidungsdatum | Thema |
|---|---|---|---|---|
| 000 | ADR Template | 📋 | - | Dokumentation |
| 001 | Frontend Framework auswählen | 📋 | TBD | Architektur |
| 002 | State Management | 📋 | TBD | Architektur |
| 003 | Testing Framework | 📋 | TBD | Quality |
| 004 | Build Tool & Bundler | 📋 | TBD | DevOps |
| 005 | Node.js Version & LTS-Policy | 📋 | TBD | Infrastruktur |

---

## ADR-Lebenszyklus

```
Issue                PR              Merged              Review
(Discussion)        (ADR-File)      to main             (6 Monate später)
   │                   │               │                    │
   v                   v               v                    v
[Propose]──────→[Review & Draft]──→[Accept]────────→[Evaluate & Update]
   7 Tage         3-5 Reviews       1 Merge             oder Supersede
```

### Phasen erklärt

#### 1. **Proposed Phase** (Issue)
- **Dauer:** ~7 Tage
- **Wo:** GitHub Issue (Label: `adr`, `decision-required`)
- **Ziel:** Team & Community einbinden
- **Beispiel-Frage:** "Sollen wir React oder Vue verwenden?"

#### 2. **Review Phase** (PR)
- **Dauer:** 3-5 Tage
- **Wo:** GitHub PR mit ADR-Datei (Label: `adr`)
- **Review:** Min. 2 Approvals von Senior-Entwicklern
- **Format:** Nutze ADR-000-template.md

#### 3. **Accepted Phase**
- **Dauer:** Unbegrenzt (bis superseded)
- **Wo:** docs/adr/ADR-XXX.md im main-Branch
- **Status:** Aktive Entscheidung, die Entwicklung leitet

#### 4. **Evaluation Phase** (Optional)
- **Dauer:** Nach 6-12 Monaten (regelmäßige Reviews)
- **Frage:** "War diese Entscheidung richtig? Sollten wir sie ändern?"
- **Outcome:** Accept (weiterhin gültig) oder Supersede (neue ADR erstellen)

---

## Wie erstelle ich eine ADR?

### Schritt 1: Issue erstellen (Discussion)

```bash
gh issue create \
  --title "[ADR] Entscheidung: Welches Frontend-Framework?" \
  --label "adr,decision-required,discussion" \
  --body "## Kontext
Wir müssen ein Frontend-Framework wählen.

## Optionen
- React 18
- Vue 3
- Svelte

## Diskussionspunkte
1. Team-Erfahrung?
2. Performance-Anforderungen?
3. A11y-Support?

## Timeline
Abstimmung bis [Datum]"
```

**Dauer:** ~7 Tage Discussion

---

### Schritt 2: ADR schreiben (Draft)

Erstelle Datei `docs/adr/ADR-001-frontend-framework.md`:

```bash
cp docs/adr/ADR-000-template.md docs/adr/ADR-001-frontend-framework.md
```

Editiere die Datei und fülle folgende Sektionen aus:
- ✅ Kontext
- ✅ Entscheidung
- ✅ Begründung
- ✅ Alternativen
- ✅ Konsequenzen + Mitigationen
- ✅ Implementierungs-Roadmap

---

### Schritt 3: PR erstellen (Review)

```bash
git add docs/adr/ADR-001-frontend-framework.md
git commit -m "docs(adr): ADR-001 – Frontend Framework Entscheidung"
git push origin feature/adr-001-frontend-framework
gh pr create \
  --title "docs(adr): ADR-001 – Frontend Framework auswählen" \
  --body "Dokumentiert die Entscheidung für React 18 basierend auf Issue #XYZ Diskussion." \
  --label "adr,documentation" \
  --draft
```

**PR-Checkliste:**
- [ ] Issue-Nummer verlinkt
- [ ] Diskussions-Ergebnisse dokumentiert
- [ ] Alternativen fair dargestellt
- [ ] Konsequenzen realistisch
- [ ] Min. 2 Reviews erforderlich

---

### Schritt 4: Merge & Accept

Nach Approvals:

```bash
gh pr merge <PR-Number> --squash
```

**Update ADR-Status:** `Proposed` → `Accepted`

---

## Best Practices

### ✅ DO

- ✅ **ADR für große Entscheidungen:** Tech-Stack, Architektur, Patterns
- ✅ **Neutral schreiben:** Alle Optionen fair bewerten
- ✅ **Konkret sein:** Keine vagen Aussagen ("wahrscheinlich besser")
- ✅ **Konsequenzen dokumentieren:** Positive UND Negative
- ✅ **Regelmäßig reviewen:** Nach 6-12 Monaten überprüfen
- ✅ **Updaten bei Änderungen:** Wenn sich etwas fundamental ändert

### ❌ DON'T

- ❌ **ADR statt schneller Bugs:** Nicht für jeden kleinen Fix
- ❌ **Zu kurz:** Mindestens 300 Wörter, erklärbar ohne Vorwissen
- ❌ **Voreingenommenheit:** Eine Option von Anfang an kritisieren
- ❌ **"Entschieden von oben":** ADRs sind Team-Entscheidungen
- ❌ **Vergessen:** ADRs müssen gelebt und evaluiert werden

---

## Konvention

### Datei-Naming

```
ADR-<Nummer>-<kurzer-beschreibung>.md

Beispiele:
- ADR-001-frontend-framework.md
- ADR-002-state-management.md
- ADR-003-testing-framework.md
```

### Nummering

- Laufende Nummern: ADR-001, ADR-002, ...
- Nicht reusable Nummern (Lücken sind OK)
- Neue ADR = nächste höchste Nummer

### Titel-Format im GitHub Issue

```
[ADR] <Entscheidungsgegenstand>
```

Beispiele:
- `[ADR] Frontend Framework – React vs. Vue vs. Svelte`
- `[ADR] State Management Library auswählen`

---

## Integration mit Projektmanagement

### Issue-Labels

| Label | Bedeutung |
|---|---|
| `adr` | Architecture Decision Record |
| `decision-required` | Entscheidung ausstehend |
| `discussion` | Offene Diskussion |
| `blocked` | Andere ADR blockiert diese |

### Linking

**In Issue-Body:**
```markdown
Abhängig von: #XYZ (ADR für Basis-Framework)
Blockt: #ABC (ADR für State Management)
```

---

## Beispiel-ADR (komplett)

Siehe [ADR-001-frontend-framework.md](./ADR-001-frontend-framework.md) (wird später erstellt)

---

## Häufig gestellte Fragen (FAQ)

### F: Wann sollte ich eine ADR erstellen?

**A:** Wenn die Entscheidung:
- Die Architektur prägt (> 6 Monate Gültigkeit)
- Mehrere Team-Mitglieder betrifft
- Schwer zu rückgängig zu machen ist
- Langfristige Kosten/Nutzen hat

**Nicht für:**
- Kleine Bug-Fixes
- Unbedeutende Library-Wahl
- Tägliche Entwicklungs-Entscheidungen

### F: Kann ich eine ADR ändern?

**A:** Ja, aber:
1. Wenn nur Klarstellung: Update direkt
2. Wenn fundamentale Änderung: Neue ADR erstellen, alte als "Superseded" markieren

Beispiel: Wenn React-Decision später zu Vue wechselt:
```markdown
**Status:** Superseded by ADR-006
```

### F: Wie lange sollte ich diskutieren?

**A:** Standard: ~7 Tage
- Einfache Entscheidung: 3-5 Tage
- Komplexe Entscheidung: 2 Wochen
- Kritische Entscheidung: 3 Wochen

### F: Wer kann eine ADR schreiben?

**A:** Jeder im Team! Aber:
- Idealerweise jemand mit Kontext
- Review von mindestens 1 Senior-Dev
- Genehmigung durch BDFL oder Tech Lead

### F: Sind ADRs bindend?

**A:** **Ja, solange sie "Accepted" sind.** Sie können nicht einfach ignoriert werden. Wenn jemand ein Problem mit einer ADR hat:
1. Diskutiert im Team
2. Neue ADR schreiben, die alte superseded
3. Implementierung anpassen

---

## Tools & Automation

### ADR-Generierung

Verwende das Template `ADR-000-template.md` als Basis für neue ADRs:

```bash
cp docs/adr/ADR-000-template.md docs/adr/ADR-XXX-your-decision.md
```

### Validierung (geplant)

- GitHub Action zur Syntax-Validierung
- Checklist für Merge
- Lint-Rule für Template-Erfüllung

---

## Kontakt & Fragen

Hast du Fragen zu ADRs?
- **Discord:** #architecture-decisions
- **GitHub:** Öffne Issue mit Label `adr`
- **Docs:** Siehe [ARCHITECTURE.md](../ARCHITECTURE.md)

---

## Verwandte Ressourcen

- [ADR GitHub Repository](https://adr.github.io/)
- [MADR – Markdown ADR](https://adr.github.io/madr/)
- [Architecture Decision Record (ADR) – Examples](https://github.com/joelparkerhenderson/architecture_decision_record)
- [Documenting Architecture Decisions – Michael Nygard](http://thinkrelevant.com/blog/2011/11/15/documenting-architecture-decisions/)

---

**Letzte Aktualisierung:** 2026-01-08
**Nächste Überprüfung:** 2026-07-08 (6 Monate)
