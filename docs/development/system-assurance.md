# System-Assurance für risikoreiche Großvorhaben

## Ziel

System-Assurance ersetzt die Annahme „grüne Checks und keine offenen Reviews
bedeuten korrekt“ durch nachvollziehbare Systembehauptungen und direkte
Evidenz. Das Verfahren gilt nur für Vorhaben mit neuen systemübergreifenden
Invarianten, insbesondere bei verteilten Zuständen, Nebenläufigkeit,
Retry/Recovery, Trust Boundaries oder gekoppelten Persistenz-/Runtime-
Übergängen.

Kleine, lokal begrenzte Änderungen benötigen keinen Assurance Case.

## Verbindliches Artefakt

Der OpenSpec-Change enthält vor Implementierungsbeginn eine Datei
`openspec/changes/<change-id>/assurance.md`. Sie wird gemeinsam mit
`proposal.md`, `design.md`, `tasks.md` und den Spec-Deltas gepflegt.

Ein Assurance Case ist vollständig, wenn jede kritische Invariante entweder
direkte Evidenz besitzt oder ein verbleibendes Risiko ausdrücklich entschieden
wurde. Formale OpenSpec-Validierung, Coverage und allgemeine Reviews bestätigen
diese Vollständigkeit nicht eigenständig.

## Evidenzklassen

- **Vertrag:** Runtime-Parser, Datenbank-Constraint oder statischer Guard
- **Zustandsmodell:** tabellen-, modell- oder eigenschaftsbasierter Test
- **Fehlerinjektion:** reproduzierbarer Fehler zwischen kritischen Teilschritten
- **Konkurrenz:** parallele Starts, verlorene Claims, Redelivery oder Replay
- **Integration:** reale Persistenz-, Queue-, Worker- oder Adaptergrenze
- **Topologie:** Cold Start, Worker-Profil, Deployment- oder Startup-Reihenfolge
- **End-to-End:** beobachtbares Verhalten an der Benutzer- oder API-Grenze
- **Betrieb:** Erkennung, Alarmierung und dokumentierte Recovery
- **Manuell:** reproduzierbarer Nachweis mit Umgebung, Schritten und Ergebnis

Eine hohe Coverage-Zahl ist keine eigene Evidenzklasse. Sie kann nur anzeigen,
ob bereits ausgewählte Codepfade ausgeführt wurden.

## Template für `assurance.md`

```markdown
# Assurance Case: <Change-ID>

## Geltungsbereich und Annahmen

- Betroffene Systeme und Packages:
- Externe Abhängigkeiten:
- Ausdrücklich nicht abgedeckter Scope:
- Vertrauensannahmen:

## Systemgrenzen und Verbraucher

| ID     | Eintritts-/Ausführungsgrenze | Vorbedingung | Durchsetzung | Recheck | Verbraucher |
| ------ | ---------------------------- | ------------ | ------------ | ------- | ----------- |
| BND-01 | ...                          | ...          | ...          | ...     | ...         |

## Zustände und Übergänge

| Von | Ereignis | Persistente Writes | Externe Arbeit | Fehler-/Crashpunkt | Nachzustand/Recovery |
| --- | -------- | ------------------ | -------------- | ------------------ | -------------------- |
| ... | ...      | ...                | ...            | ...                | ...                  |

## Invariantenregister

### INV-01: <präzise, prüfbare Behauptung>

- Kritikalität: [kritisch | hoch | normal]
- Geltungsbereich:
- Verletzungsszenarien:
- Prävention:
- Erkennung:
- Recovery:
- Direkte Evidenz:
  - `<Test-/Check-/Runbook-Pfad oder reproduzierbarer Befehl>`
- Offene Nachweislücken:
- Restrisiko und Entscheidung:

## Failure-Mode- und Evidenzmatrix

| Fehler-/Konkurrenzfall | Betroffene Invarianten | Erwartetes Ergebnis | Evidenz | Status |
| ---------------------- | ---------------------- | ------------------- | ------- | ------ |
| ...                    | INV-01                 | ...                 | ...     | [offen | belegt | Restrisiko akzeptiert] |

## Merge-Entscheidung

- [ ] Jede kritische Invariante besitzt direkte Evidenz.
- [ ] Jeder nicht-terminale Zustand besitzt einen Konvergenz- oder Recovery-Pfad.
- [ ] Alle bekannten Eintritts-, Dispatch- und Execution-Grenzen sind erfasst.
- [ ] Teilfehler, Konkurrenz, Redelivery, Prozessabbruch und Wiederanlauf sind bewertet.
- [ ] Nicht automatisierbare Annahmen sind reproduzierbar geprüft oder als Restrisiko entschieden.
- [ ] Es existieren keine unbekannten oder unzugeordneten Nachweislücken.
```

## Arbeitsweise

1. Invarianten und Grenzen vor dem ersten Implementierungsblock formulieren.
2. Verletzungsszenarien und Failure Modes unabhängig von der geplanten
   Implementierung sammeln.
3. Für jede Invariante die kleinstmögliche direkte Evidenz festlegen.
4. Tests und Fehlerinjektion parallel zu den betroffenen Lieferabschnitten
   implementieren.
5. Neue Review-, CI- oder Betriebsbefunde zuerst dem Invariantenregister
   zuordnen. Wiederholte Befunde derselben Invariante lösen eine vollständige
   Prüfung ihres Zustandsraums und aller Verbraucher aus.
6. Vor Merge den Assurance Case gegen den exakten HEAD und die tatsächlich
   vorhandenen Nachweise prüfen.

## Abgrenzung zu Reviews und CI

Reviews dürfen neue Gegenbeispiele finden und die Qualität der Evidenz
bewerten. Sie dürfen jedoch nicht aus dem Ausbleiben weiterer Findings auf
Vollständigkeit schließen. CI führt die definierten Nachweise reproduzierbar
aus, entscheidet aber nicht, ob die Menge der Invarianten vollständig ist.

Die fachliche Merge-Entscheidung bleibt beim Menschen. Kritische Invarianten
ohne Evidenz oder akzeptierte Restrisikoentscheidung blockieren diese
Entscheidung unabhängig vom sonstigen Check-Status.
