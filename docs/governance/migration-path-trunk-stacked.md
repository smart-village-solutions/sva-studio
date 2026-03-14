# Migrationspfad: Trunk+Stacked-Modell

Dieses Dokument beschreibt den schrittweisen Übergang vom bisherigen develop-zentrierten Workflow zum neuen Modell auf Basis von Trunk-Entwicklung und gestapelten Pull Requests (Stacked PRs).

## 1. Strategischer Ansatz: Inkrementelle Migration

Um den laufenden Entwicklungsbetrieb nicht zu gefährden, erfolgt die Umstellung **inkrementell**. Es gibt keine "Big-Bang"-Aktion, bei der alle bestehenden Branches gleichzeitig rebased oder umbenannt werden müssen.

### Zweigleisige Strategie (Dual-Handling)
1. **Neue Arbeit:** Alle ab sofort (Beginn Phase 2) startenden Aufgaben müssen zwingend der neuen [Branch-Taxonomie](./branch-taxonomy.md) und den [Stacked-PR-Regeln](./stacked-pr-rules.md) folgen.
2. **Bestehende Arbeit:** Offene Pull Requests und laufende Branches, die vor Beginn der Phase 2 erstellt wurden, genießen einen begrenzten Bestandsschutz ("Grandfathering").

---

## 2. Handhabung bestehender Arbeit (Open PRs)

Für bereits offene PRs gelten während der Übergangsphase folgende Regeln:

- **Bestandsschutz:** Bestehende PRs dürfen gegen ihre ursprünglichen Targets (z. B. `develop`) weitergeführt werden, bis sie gemerged oder geschlossen sind.
- **Keine Pflicht-Umbenennung:** Eine manuelle Umbenennung bestehender Branches auf das neue Präfix-Schema (z. B. `stack/`) ist nicht erforderlich, wird aber empfohlen, falls der PR voraussichtlich länger als 7 Tage offen bleibt.
- **Rebase-Empfehlung:** Bei größeren Konflikten während der Transition sollten bestehende Branches direkt gegen `main` rebased und auf das neue Schema umgestellt werden.

---

## 3. Regeln für neue Arbeit (ab Phase 2)

Mit dem Eintritt in Phase 2 (Transition) gelten für alle neuen Branches folgende strikte Vorgaben:

- **Basis-Branch:** Alle neuen Feature-Ketten starten von `main`. Der Branch `develop` wird als Ziel für neue Features deaktiviert.
- **Branch-Präfixe:** Verwendung der Klassen `feature/`, `fix/`, `chore/`, `stack/`, `epic/`.
- **Stack-Tiefe:** Die maximale Tiefe von 3 abhängigen PRs ist ab Tag 1 der Phase 2 für neue Ketten verbindlich.
- **Hook-Validierung:** Neue Branches müssen das `stack/`-Präfix verwenden, auch wenn die serverseitige Hook-Validierung in der ersten Woche der Phase 2 noch auf "Warning" gestellt ist.

---

## 4. Zeitplan und Cutover-Deadline

Die Transition folgt dem [Rollout-Plan](./rollout-plan.md). Die finale Ablösung des alten Modells ist an folgende numerische Frist gebunden:

- **Cutover-Datum:** **30 Tage nach Eintritt in Phase 2** (Onboarding).
- **Stichtag:** Ab diesem Tag (T+30) werden keine Merges mehr in den alten `develop`-Branch erlaubt.
- **Deaktivierung:** Der Branch `develop` wird 14 Tage nach dem Cutover-Datum (T+44) archiviert oder gelöscht, sofern alle relevanten Änderungen in `main` integriert sind.

---

## 5. Eskalationspfad bei Altlasten

Sollten PRs im alten Modell über die Cutover-Deadline hinaus persistieren, greifen folgende Maßnahmen:

1. **Warnung (T-7 Tage vor Deadline):** Automatisierter Kommentar in allen PRs, die noch auf `develop` zeigen, mit Aufforderung zum Retargeting auf `main`.
2. **Merge-Block (T+0):** Die Merge-Berechtigung für PRs gegen `develop` wird entzogen.
3. **Zwangs-Migration (T+7 Tage nach Deadline):** Maintainer führen ein Force-Retargeting auf `main` durch. Entstehende Konflikte müssen vom Autor innerhalb von 48 Stunden gelöst werden.
4. **Archivierung (T+14 Tage nach Deadline):** Stale PRs im alten Modell, die nicht migriert wurden, werden mit dem Hinweis "Workflow Deprecated" geschlossen.

---

## 6. Technische Begleitmaßnahmen

### Hook-Migration
Wie in der Branch-Taxonomie (T2) identifiziert, muss der Git-Hook `.githooks/reference-transaction` aktualisiert werden, um das `stack/`-Präfix zu erlauben.
- **Aktion:** Aufnahme von `stack` in die `prefixes`-Variable (Zeile 14).
- **Zeitpunkt:** Spätestens zu Beginn von Phase 2 (Transition).

### CI/CD Anpassung
Die Preview-Infrastruktur wird primär auf Branches ausgerichtet, die gegen `main` zielen. Bestehende `develop`-Previews werden bis zum Cutover-Datum weiter betrieben, danach aber priorisiert abgebaut, um Ressourcen für das Stacked-Modell freizugeben.
