# Proposal Review – Konsolidierter Report

## Meta

| Feld | Wert |
|------|------|
| **Change-ID** | `<change-id>` |
| **Proposal-Titel** | … |
| **Review-Datum** | … |
| **Aufgerufene Reviewer** | 🏛️ Architecture, 🔒 Security, 📝 Documentation, … |
| **Übersprungene Reviewer** | … (mit Begründung) |
| **Modus** | Report / Apply |

## Gesamtbewertung

| Aspekt | Bewertung | Reviewer |
|--------|-----------|----------|
| Architektur | konform / kritisch / Abweichung | 🏛️ |
| Security & Privacy | Merge-OK / Blocker / Auflagen | 🔒 |
| Dokumentation | Low / Medium / High | 📝 |
| UX & Accessibility | OK / Abweichung | ♿ |
| Operations | Low / Medium / High | ⚙️ |
| Interoperabilität | hoch / mittel / niedrig | 🔌 |
| Logging | Low / Medium / High | 📊 |

**Gesamtempfehlung:** [Implementierung freigeben | Nacharbeit erforderlich | Grundlegende Überarbeitung nötig]

## Findings (konsolidiert und priorisiert)

### 🔴 Blocker

| ID | Thema | Reviewer | Betroffene Datei | Empfehlung |
|---:|-------|----------|------------------|------------|
| B1 | … | 🏛️/🔒/… | `proposal.md` / `design.md` / … | … |

#### B1 – Kurztitel
- **Quelle:** [Agent-Name]
- **Beschreibung:** …
- **Impact:** …
- **Empfehlung:** …
- **Status:** ⬜ Offen / ✅ Eingearbeitet (nur im Apply-Modus)

### 🟡 Wichtig

| ID | Thema | Reviewer | Betroffene Datei | Empfehlung |
|---:|-------|----------|------------------|------------|
| W1 | … | … | … | … |

#### W1 – Kurztitel
- **Quelle:** [Agent-Name]
- **Beschreibung:** …
- **Impact:** …
- **Empfehlung:** …
- **Status:** ⬜ Offen / ✅ Eingearbeitet

### 🟢 Hinweise

| ID | Thema | Reviewer | Empfehlung |
|---:|-------|----------|------------|
| H1 | … | … | … |

### ℹ️ Informationen

- …

## Konflikte zwischen Reviewern

> Wenn keine Konflikte: „Keine Konflikte zwischen Reviewern festgestellt."

### Konflikt K1 – Kurztitel

| Position A | Position B |
|------------|------------|
| [Agent A]: … | [Agent B]: … |

**Orchestrator-Vorschlag:** …
**Entscheidung:** ⬜ Offen (Mensch entscheidet)

## Offene Fragen an den Proposal-Autor

1. …
2. …

## Checkliste

- [ ] Alle 🔴-Blocker adressiert
- [ ] Alle 🟡-Punkte bewertet (fix oder bewusst akzeptiert)
- [ ] Konflikte entschieden
- [ ] `openspec validate <change-id> --strict` erfolgreich
- [ ] Offene Fragen beantwortet

## Nächste Schritte

1. …
2. …
3. …

---

*Erstellt vom Proposal Review Orchestrator am [Datum]*
