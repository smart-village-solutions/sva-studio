# System-Assurance-Review – Template

> Dieses Template ist ein Baukasten. Nicht relevante Abschnitte entfallen;
> fallbezogen geeignetere Darstellungen sind ausdrücklich zulässig.

## Entscheidung

- Prüfphase: [Planungsreview | Nachweisreview]
- Ergebnis: [Planungsreif | Nachweisreif | Reif mit Restrisiko | Implementierungsblocker | Merge-Blocker]
- Bewerteter HEAD:
- Assurance Case:
- Begründung:

## Modellabdeckung (soweit für den Fall relevant)

- Erfasste Systeme und Verbraucher:
- Fehlende oder unklare Grenzen:
- Fehlende oder widersprüchliche Zustände:
- Nicht geprüfte Annahmen:

## Invarianten-Evidenz (soweit hilfreich)

Zulässige Statuswerte: `offen`, `geplant`, `belegt`, `Lücke` und
`Restrisiko akzeptiert`.

| Invariante | Kritikalität | Direkte Evidenz         | Gegenbeispiele geprüft | Status  |
| ---------- | ------------ | ----------------------- | ---------------------- | ------- |
| INV-01     | kritisch     | Test/Constraint/Runbook | Fehlerfälle            | geplant |

## Boundary- und Consumer-Abdeckung (soweit relevant)

| Boundary-ID | Produzent/Eintritt | Durchsetzung | Recheck | Verbraucher | Evidenz | Status |
| ----------- | ------------------ | ------------ | ------- | ----------- | ------- | ------ |
| BND-01      | ...                | ...          | ...     | ...         | ...     | ...    |

## Gegenbeispiele und Failure Modes (soweit relevant)

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

## Entscheidungskriterien

- [ ] Die für den konkreten Risikofall wesentlichen Behauptungen sind erfasst
- [ ] Die gewählte Nachweistiefe ist dem Risiko angemessen
- [ ] Kritische offene Risiken besitzen Owner und Entscheidung
- [ ] Allgemeine CI/Coverage wird nicht als Ersatz für fallbezogene Evidenz verwendet
- [ ] Nicht verwendete Template-Teile wurden nicht nur aus Bequemlichkeit ausgelassen

## Verifizierte Befehle und Nachweise

- `<Befehl oder Artefakt>` → `<Ergebnis>`
