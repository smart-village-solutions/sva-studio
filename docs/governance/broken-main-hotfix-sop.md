# Broken-Main- und Hotfix-SOP

## Ziel und Geltungsbereich

Diese SOP definiert den verbindlichen Incident-Ablauf bei rotem `main` sowie den Hotfix-Flow unter Beibehaltung der Trunk-Prinzipien. Sie gilt für alle Änderungen mit Zielbranch `main` und ergänzt:

- `docs/governance/merge-review-gates.md` (Revert-first, SLA)
- `docs/governance/branch-protection-merge-queue-policy.md` (Required Checks, Bypass)
- `docs/governance/preview-security-compliance-guardrails.md` (Incident-Reaktionsmuster)

## Betriebsmodell

Die Rollen in dieser SOP sind funktionsbasiert definiert. In fruehen Projektphasen oder bei kleiner Besetzung koennen mehrere Rollen durch dieselbe Verantwortungsgruppe wahrgenommen werden, sofern Incident-Owner, Entscheidung und Audit-Spur klar dokumentiert bleiben. Das Zielbild einer staerkeren organisatorischen Trennung bleibt davon unberuehrt.

## Verbindliche Leitplanken

- **SLA:** `main` muss spätestens innerhalb von **30 Minuten** nach Detection wieder grün sein.
- **Default-Strategie:** Revert-first; Forward-Fix ist Ausnahmefall.
- **Bypass-Grenze:** Nur bei **P0/P1**-Produktionsvorfällen mit vollständiger Audit-Spur.
- **Keine stillen Ausnahmen:** Jede Abweichung muss im Incident-Issue und im PR dokumentiert sein.

## Runbook: Broken Main (deterministische Kette)

| Schritt | Max. Zeit ab Detection | Verantwortlich | Aktion | Ergebnisnachweis |
| --- | ---: | --- | --- | --- |
| 1. Detection | 5 Minuten | CI-Monitoring + Merge-Verursacher:in | Detection über fehlschlagende Required Checks auf `main` oder manuelle Eskalation in `#incident-main` | Incident-Issue angelegt/verlinkt |
| 2. Owner-Übernahme | 10 Minuten | L1: Merge-Verursacher:in | Incident-Owner bestätigen, Merge-Freeze für `main` ausrufen, betroffene SHA markieren | PR-Kommentar mit Owner, SHA, Startzeit |
| 3. Mitigation | 25 Minuten | L1, bei Übergabe L2: On-Call Maintainer | Standard: Revert des auslösenden Merges; Ausnahme: Forward-Fix nur bei erfüllten Kriterien (siehe unten) | Revert-PR oder Fix-PR mit Incident-Referenz |
| 4. Verification | 30 Minuten | Incident-Owner | Nach Mitigation alle Required Checks auf `main` erneut grün verifizieren | Check-Status und Abschlusskommentar im Incident |

## Detection-Regeln

- **Automatisch (primär):** Alarm bei rotem Required Check auf `main` aus GitHub Checks/Monitoring.
- **Manuell (sekundär):** Jeder Maintainer darf bei bestätigtem Fehler sofort ein Incident-Issue eröffnen.
- **Verpflichtende Erfassung:** Detection-Zeitpunkt wird im Incident-Issue als `detected_at` (UTC) dokumentiert.

## Eskalationskette (fest, numerisch)

| Level | Trigger | Reaktionszeit | Rolle | Pflichtaktion |
| --- | --- | ---: | --- | --- |
| L1 | Detection erfolgt | 15 Minuten | Merge-Verursacher:in | Incident übernehmen, Revert vorbereiten/einspielen |
| L2 | L1 nicht aktiv oder keine grüne Tendenz | weitere 15 Minuten | On-Call Maintainer bzw. zuständige Verantwortungsgruppe | Entscheidung Revert vs. Forward-Fix, Umsetzung steuern |
| L3 | SLA-Risiko oder Blockade durch Protection | sofort nach Minute 30 oder früher bei P0/P1 | Admin (Emergency) | nur bei P0/P1: kontrollierter Bypass gemäß Audit-Pflichten |

## Mitigationsentscheidung: Revert-first

### Standardpfad: Revert (ohne zusätzliche Freigabe)

- Revert ist Standard und benötigt **keine zusätzliche Freigabe**.
- Revert-PR muss enthalten:
  - Incident-Issue-Link,
  - fehlerauslösende SHA,
  - Kurzbegründung,
  - Verweis auf erwartete Wiederherstellungszeit.

### Ausnahmepfad: Forward-Fix (nur unter Bedingungen)

Forward-Fix ist nur zulässig, wenn **alle** Bedingungen erfüllt sind:

1. **Freigabe durch Maintainer** (namentlich im PR-Kommentar dokumentiert).
2. **Zeitvergleich belegt:** geschätzte `time_to_fix` ist **kleiner** als `time_to_revert`.
3. **SLA-konformität:** verbleibende Zeit bis Minute 30 ist ausreichend für Build + Required Checks.
4. **Risikobewertung:** kein erhöhtes Risiko für weitere Regressionen (kurze Begründung im Incident).

Fehlt eine Bedingung, ist unverzüglich auf Revert zurückzuschalten.

## Verification-Checkliste nach Mitigation

Vor Aufhebung des Merge-Freeze müssen auf `main` grün sein:

1. `Lint / lint`
2. `Unit / unit`
3. `Types / types`
4. `Test Coverage / coverage`
5. `App E2E / e2e` (wenn `apps/` betroffen ist)

Zusätzlich verpflichtend:

- Incident-Issue enthält `owner`, `cause_sha`, `mitigation`, `verified_at`.
- PR-Checkliste gemäß `docs/reports/PR_CHECKLIST.md` ist für Revert/Fix nachvollziehbar erfüllt.

## Hotfix-Workflow (kompatibel mit Branch Protection)

### Standard-Hotfix (ohne Bypass)

1. Branch `hotfix/<kebab-case-beschreibung>` von `main` erstellen.
2. Korrektur als kleinsten reversiblen Change umsetzen.
3. PR nach `main` mit Incident-Issue verlinken.
4. Required Checks und Reviews gemäß Branch-Protection vollständig durchlaufen.
5. Merge über regulären, auditierbaren Pfad.

### Emergency-Hotfix mit Bypass (streng begrenzt)

Bypass ist nur zulässig, wenn **gleichzeitig** gilt:

- Vorfall ist als **P0** oder **P1** klassifiziert.
- Incident-Issue ist vorhanden und im PR verlinkt.
- PR-Kommentar enthält Begründung, Risikoabschätzung und freigebende Rolle.
- Freigabe durch Maintainer oder Incident Commander ist explizit dokumentiert.

Nachgelagerte Pflichtmaßnahmen:

- Incident-Review innerhalb von **48 Stunden**.
- Retrospektive mit Korrekturmaßnahmen (z. B. zusätzlicher Test/Gate) innerhalb von **5 Arbeitstagen**.
- Audit-Trail (Issue, PR-Kommentare, SHA, Zeitstempel) muss vollständig sein.

## Rollen und Verantwortlichkeiten

- **Merge-Verursacher:in (L1):** Erstreaktion, Revert-first-Ausführung, Initialkommunikation.
- **On-Call Maintainer (L2):** Entscheidungshoheit bei Forward-Fix, Sicherstellung SLA-Konformität.
- **Admin Emergency (L3):** letzter Eskalationspfad für P0/P1-Bypass unter vollständiger Auditpflicht.
- **Incident-Owner:** Abschlussverifikation, Dokumentation, Follow-up-Tracking.
- **Fruehphasen-Regel:** Wenn L1, L2 oder Incident-Owner personell zusammenfallen, muss dieser Zustand im Incident explizit vermerkt werden; die Freigabe- und Auditpflichten bleiben unveraendert bestehen.

## Definition of Done für Incident-Abschluss

Ein Broken-Main/Hotfix-Incident ist erst abgeschlossen, wenn alle Punkte erfüllt sind:

1. `main` ist wieder grün innerhalb der 30-Minuten-SLA.
2. Mitigationspfad (Revert oder Forward-Fix) ist im Incident begründet.
3. Alle Required Checks sind nachweislich grün.
4. Audit-Spur ist vollständig und verlinkt.
5. Follow-up-Tickets für Präventionsmaßnahmen sind angelegt.
