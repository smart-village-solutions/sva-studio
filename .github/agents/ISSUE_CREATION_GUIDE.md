# Agent Issue Creation Guide

Alle 5 Reviewer-Agents können dir GitHub-CLI-Befehle (`gh issue create`) geben. Du führst sie manuell aus, damit du volle Kontrolle über die Issue-Erstellung hast. Dieses Dokument legt die Standards fest.

## Duplikat-Prüfung (Kritisch!)

Bevor du ein Issue erstellst, **MUSST du prüfen**, ob es bereits ein ähnliches Issue gibt:

### Suchstrategie

**Automatische Suche** (wenn der Agent ein Issue vorschlägt):
```bash
# Suche nach Keywords im Title
gh issue list --search "KEYWORD in:title" --state all --json number,title,state

# Beispiel - Duplikat prüfen:
gh issue list --search "Authentication in:title" --state all
```

**Manuell im Browser**:
1. Gehe zu https://github.com/smart-village-solutions/sva-studio/issues
2. Filtere nach Labels (z.B. `security`, `documentation`)
3. Nutze die Suchleiste: `label:documentation ARCHITECTURE`
4. Sortiere nach Newest/Most Commented

### Was ist ein Duplikat?

**Ist ein Duplikat**:
- ✅ Gleiches Thema, gleiche Lösung erwartet
- ✅ Ein Issue löst den anderen vollständig
- ✅ Issues können gemeinsam gelöst werden

**Ist KEIN Duplikat**:
- ❌ Unterschiedliche Aspekte des gleichen Themas
- ❌ Ein Issue ist Voraussetzung für den anderen
- ❌ Unterschiedliche Prioritäten/Timelines

### Wenn du ein Duplikat findest

1. **Kommentiere** im neuen Issue: "Duplikat von #XYZ"
2. **Schließe** das neue Issue: `gh issue close <new-issue-number>`
3. **Kommentiere** im Original: "Zusammengeführt mit PR #XYZ"
4. **Lerne**: Warum hast du das Duplikat übersehen? Better search strategy?

### Wenn Issues verwandt sind (nicht Duplikat)

1. **Verlinke** sie: "Siehe auch #XYZ"
2. **Erkläre** die Abhängigkeit: "This issue blocks #XYZ because..."
3. **Definiere** Abhängigkeiten im Body: "## Depends On: #XYZ, #ABC"

---

## Issue-Erstellung durch Agents

### Wann Issues erstellen?

**Generelle Regel**: Ein Agent erstellt ein Issue, wenn:
- ✅ Eine **konkrete Handlung erforderlich** ist (nicht nur Information)
- ✅ Die Handlung **außerhalb des PR-Review** liegt (z.B. Docs schreiben, Konfiguration setzen)
- ✅ Die Handlung **nicht-trivial** ist (nicht in < 30 Min zu erledigen)

**Wann NICHT?**
- ❌ Inline-Feedback zu Code im PR (→ Kommentar im Review)
- ❌ Triviale Fixes (< 30 Min) → direkt im PR beheben
- ❌ Ideen ohne Handlungsbefugnis → Diskussion im PR

---

## Agent-spezifische Patterns

### 🔐 Security & Privacy Agent

**Labels**:
- `security` (immer)
- `blocker` (nur 🔴 Merge-Blocker)
- `compliance` (DSGVO/BSI/CRA)
- `investigation` (Research-Phase)
- `audit-trail` (Logging/Audit)

**Issue-Titel-Format**:
```
[Security] <Kategorie>: <Maßnahme>
```

**Beispiele**:
```
[Security] Audit Trail: Implementiere Immutable Logs
[Security] Compliance: SBOM-Generator einbauen (CycloneDX)
[Security] RLS-Policies: Durchsetze Row-Level-Security in auth_user
```

**Wann erstellen?**
- Fehlende Sicherheitsmaßnahmen (z.B. MFA nicht implementiert)
- Compliance-Gaps (DSGVO Datenlöschung, BSI-Checkliste)
- Secrets in Code gefunden → Sofort blocker setzen
- Unverschlüsselte Übertragungen → blocker

---

### 🏗️ Architecture Agent

**Labels**:
- `architecture` (immer)
- `adr` (Architecture Decision Record nötig)
- `tech-debt` (mit Langzeitwirkung)
- `fit-compliance` (Föderale IT)
- `vendor-lock-in`

**Issue-Titel-Format**:
```
[Architecture] <ADR-Topic> oder [Arch-Debt] <Schuld>
```

**Beispiele**:
```
[Architecture] ADR: API-Versionierungsstrategie dokumentieren
[Architecture] ADR: Supabase Lock-in Mitigation Plan
[Arch-Debt] Vendor-Lock-in: Generische DB-Abstraktionsschicht erforderlich
```

**Wann erstellen?**
- ADR-Anforderung identifiziert (z.B. "API-Design-Pattern")
- Tech-Debt mit > 6 Monats Horizon (z.B. "Modulgrenzen unsauber")
- FIT-Abweichung (z.B. "Proprietärer vs. Open Standard")
- Vendor-Lock-in-Mitigation erforderlich

---

### 🔗 Interoperability & Data Agent

**Labels**:
- `interop` (immer)
- `api` (API-Versionierung)
- `data-export` (Exportfähigkeit)
- `data-import` (Importierbarkeit)
- `open-standards`

**Issue-Titel-Format**:
```
[Interop] <Standard oder Feature>: <fehlende Fähigkeit>
```

**Beispiele**:
```
[Interop] OParl: Mapping für Benutzer.Funktion implementieren
[Interop] API: Export-Completeness für Benutzer-Daten
[Interop] Open311: Integration für Bug-Reports
```

**Wann erstellen?**
- Export/Import unvollständig oder nicht dokumentiert
- API-Dokumentation fehlt (z.B. Deprecation-Pfad)
- Proprietary Data Format statt Open Standard
- Migration/Exit für andere Gemeinden unmöglich

---

### ⚙️ Operations & Reliability Agent

**Labels**:
- `ops` (immer)
- `documentation` (Runbook/Playbook)
- `sre` (Monitoring/Logging/Alerting)
- `disaster-recovery` (Backup/RTO/RPO)
- `deployment` (Rollout-Prozess)

**Issue-Titel-Format**:
```
[Operations] <Prozess>: <fehlende Dokumentation oder Fähigkeit>
```

**Beispiele**:
```
[Operations] Runbook: Backup-Restore-Procedure (RTO 4h, RPO 1h)
[Operations] Monitoring: Health-Endpoint gibt DB-Verbindung nicht zurück
[Operations] Deployment: Zero-Downtime-Migration für neues Schema
```

**Wann erstellen?**
- Betriebsfähigkeit nicht dokumentiert
- RTO/RPO nicht erreichbar (z.B. Backup-Interval zu lang)
- Monitoring-Blind-Spots (z.B. Disk Space nicht beobachtet)
- Notfall-Szenario ohne Playbook (z.B. DB-Recovery)

---

### ♿ UX & Accessibility Agent

**Labels**:
- `accessibility` (immer)
- `wcag` (WCAG 2.1)
- `blocker` (nur AA-Level)
- `screenreader`
- `keyboard-nav`
- `contrast`

**Issue-Titel-Format**:
```
[A11y] <WCAG-Kriterium>: <fehlende Funktion>
```

**Beispiele**:
```
[A11y] 2.1.1 Keyboard: Button ohne sichtbaren Fokus
[A11y] 4.1.2 Name/Role/Value: Form-Fehler nicht ankündbar
[A11y] 3.2.4 Konsistenz: Navigations-Struktur variiert
```

**Wann erstellen?**
- WCAG AA-Verstöße (Merge-Blocker)
- Screenreader-Inkompatibilität
- Fehlende oder falsche Alt-Texte für Inhalte
- Tastaturzugang nicht möglich

---

## Wie Agents dir die Issue-Erstellung zeigen

**Agent gibt dir einen fertigen `gh`-Befehl:**

```bash
gh issue create \
  --title "[Security] Audit Trail: Implementiere Immutable Logs" \
  --body "## Beschreibung
[...Body-Inhalt...]" \
  --label "security,blocker,compliance" \
  --milestone "v.next"
```

**Du kopierst diesen Befehl und führst ihn aus:**
```bash
# Kopiere aus dem Agent-Output, füge in Terminal ein, Enter
```

---

## GitHub Issue Body Template

Alle Agents nutzen diesen Body-Standard:

```markdown
## Beschreibung
[Kurze Zusammenfassung]

## Auswirkung
- Betroffen: [Nutzer / Compliance / Betrieb]
- Risiko: [niedrig / mittel / hoch / kritisch]
- Blockiert: [PR-Link, falls relevant]

## Lösungsansatz
[Konkrete Schritte oder Richtung]

## Akzeptanzkriterien
- [ ] Schritt 1
- [ ] Schritt 2
- [ ] Tests geschrieben
- [ ] Dokumentation aktualisiert

## Referenzen
- Agent-Review: [PR-Link]
- Spec: [spec/...md](../../specs/...)
- DEVELOPMENT_RULES: [rules/DEVELOPMENT_RULES.md](../../rules/DEVELOPMENT_RULES.md)
```

---

## Duplikat-Vermeidung

Vor Issue-Erstellung prüft der Agent:

1. **Existiert das Issue bereits?**
   Workflow: Agent → `gh`-Befehl → Issue

```
1. Agent führt Review durch
2. Agent findet Issue-würdige Aufgabe
3. Agent gibt dir einen fertigen `gh`-Befehl aus
4. Du führst den Befehl im Terminal aus
5. Issue wird in GitHub erstellt
6. Du hast volle Kontrolle über den Prozess
```

---

## Fazit

**Agents geben dir `gh`-Befehle für:**
- ✅ Konkrete, nicht-triviale Aufgaben außerhalb des PR
- ✅ Compliance-Anforderungen (mit Norm-Referenz)
- ✅ Dokumentation & Runbooks
- ✅ ADRs und Tech-Debt-Items

**Agents geben dir KEINE Befehle für:**
- ❌ Inline-Code-Feedback (→ PR-Kommentare)
- ❌ Diskussionen (→ PR-Review)
- ❌ Ideen ohne Handlungsbefugnis

**Du entscheidest, ob du den `gh`-Befehl ausführst.** Das gibt dir volle Kontrolle über Ticket-Creep und Issue-Hygiene.
## Milestone-Strategie

- 🔴 Blocker → Milestone: `v.next` oder `v1.1` (nächste Version)
- 🟡 Wichtig → Milestone: `v.next` oder `Backlog`
- 🟢 Nice-to-have → Keine Milestone (Backlog nur wenn Labels suggerieren)

---

## Fazit

**Agents erstellen Issues für:**
- ✅ Konkrete, nicht-triviale Aufgaben außerhalb des PR
- ✅ Compliance-Anforderungen (mit Norm-Referenz)
- ✅ Dokumentation & Runbooks
- ✅ ADRs und Tech-Debt-Items

**Agents erstellen KEINE Issues für:**
- ❌ Inline-Code-Feedback
- ❌ Diskussionen
- ❌ Ideen ohne Handlungsbefugnis
