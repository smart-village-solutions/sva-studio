# System-Assurance-Review – Template

## Entscheidung

- Prüfphase: [Planungsreview | Nachweisreview]
- Ergebnis: [Planungsreif | Nachweisreif | Reif mit Restrisiko | Implementierungsblocker | Merge-Blocker]
- Bewerteter HEAD:
- Assurance Case:
- Begründung:

## Vollständigkeit des Modells

- Erfasste Systeme und Verbraucher:
- Fehlende oder unklare Grenzen:
- Fehlende oder widersprüchliche Zustände:
- Nicht geprüfte Annahmen:

## Invarianten-Evidenz

Zulässige Statuswerte: `offen`, `geplant`, `belegt`, `Lücke` und
`Restrisiko akzeptiert`.

| Invariante | Kritikalität | Direkte Evidenz         | Gegenbeispiele geprüft | Status  |
| ---------- | ------------ | ----------------------- | ---------------------- | ------- |
| INV-01     | kritisch     | Test/Constraint/Runbook | Fehlerfälle            | geplant |

## Boundary- und Consumer-Abdeckung

| Boundary-ID | Produzent/Eintritt | Durchsetzung | Recheck | Verbraucher | Evidenz | Status |
| ----------- | ------------------ | ------------ | ------- | ----------- | ------- | ------ |
| BND-01      | ...                | ...          | ...     | ...         | ...     | ...    |

## Gegenbeispiele und Failure Modes

### SA-01: <Kurztitel>

- Betroffene Invarianten/Boundaries:
- Ausgangszustand:
- Ereignis oder Fehlerpunkt:
- Erwartetes Verhalten:
- Tatsächliches Verhalten oder Nachweislücke:
- Reproduktion/Evidenz:
- Erforderlicher nächster Nachweis:

## Restrisiken zur Entscheidung

| ID  | Annahme/Risiko | Auswirkung | vorhandene Begrenzung | Entscheidung nötig von |
| --- | -------------- | ---------- | --------------------- | ---------------------- |

## Phasenbezogene Blocker

- [ ] Im Planungsreview keine kritische Invariante ohne konkrete Nachweisplanung
- [ ] Im Nachweisreview keine kritische Invariante ohne ausgeführte direkte Evidenz für den exakten HEAD
- [ ] Keine unbekannte oder unzugeordnete Systemgrenze
- [ ] Keine nicht-terminale Sackgasse ohne Konvergenz/Recovery
- [ ] Keine nur durch allgemeine CI/Coverage behauptete Evidenz
- [ ] Alle Restrisiken ausdrücklich entschieden

## Verifizierte Befehle und Nachweise

- `<Befehl oder Artefakt>` → `<Ergebnis>`
