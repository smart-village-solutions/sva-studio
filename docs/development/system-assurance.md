# System-Assurance für risikoreiche Großvorhaben

## Ziel

System-Assurance ersetzt die Annahme „grüne Checks und keine offenen Reviews
bedeuten korrekt“ durch nachvollziehbare Systembehauptungen und direkte
Evidenz. Das Verfahren gilt nur für risikoreiche Großvorhaben mit neuen oder
wesentlich veränderten systemübergreifenden Invarianten, die insbesondere
verteilte Zustände, Nebenläufigkeit, Retry/Recovery, sicherheitsrelevante Trust
Boundaries oder gekoppelte Persistenz-/Runtime-Übergänge betreffen.

Kleine, lokal begrenzte Änderungen benötigen keinen Assurance Case. Das bloße
Berühren eines bestehenden Retry-Pfads, einer Trust Boundary oder einer
Persistenzgrenze reicht ohne neue oder wesentlich veränderte
systemübergreifende Invariante nicht als Trigger aus.

## Anpassbarer Assurance Case

Für komplexe Fälle wird eine Datei
`openspec/changes/<change-id>/assurance.md` empfohlen. Die Inhalte dürfen
stattdessen gleichwertig in `proposal.md`, `design.md`, einem ADR oder dem PR
stehen, sofern sie zusammenhängend auffindbar und reviewbar bleiben. Das
folgende Template ist ein Baukasten: Nicht relevante Tabellen und Felder
entfallen, passende projektspezifische Darstellungen dürfen sie ersetzen.

Vor einem risikobehafteten Implementierungsblock ist der Assurance Case planungsreif, wenn die
kritischen Invarianten, Grenzen und Failure Modes beschrieben sind und jede
Invariante einer konkreten Nachweisplanung oder einer ausdrücklich akzeptierten
Restrisikoentscheidung zugeordnet ist.

Vor dem Merge ist der Assurance Case nachweisreif, wenn jede kritische
Invariante entweder tatsächlich ausgeführte direkte Evidenz für den exakten
HEAD besitzt oder ein verbleibendes Risiko ausdrücklich entschieden wurde.
Formale OpenSpec-Validierung, Coverage und allgemeine Reviews bestätigen diese
Nachweisreife nicht eigenständig.

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

## Referenztemplate für `assurance.md`

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
- Geplante direkte Evidenz:
  - `<Test-/Check-/Runbook-Pfad oder reproduzierbarer Befehl>`
- Nachweisstatus: geplant
- Ausgeführte Evidenz und Ergebnis:
- Offene Nachweislücken:
- Restrisiko und Entscheidung:

## Failure-Mode- und Evidenzmatrix

| Fehler-/Konkurrenzfall | Betroffene Invarianten | Erwartetes Ergebnis | Evidenz | Status  |
| ---------------------- | ---------------------- | ------------------- | ------- | ------- |
| ...                    | INV-01                 | ...                 | ...     | geplant |

Zulässige Statuswerte: `offen`, `geplant`, `belegt`, `Lücke` und
`Restrisiko akzeptiert`.

Die Statuswerte sind eine empfohlene gemeinsame Sprache. Für eine
Implementierungsentscheidung sind `geplant`, `belegt` oder
`Restrisiko akzeptiert` typische belastbare Zustände; vor dem Merge sind
`belegt` oder `Restrisiko akzeptiert` zu erwarten. Gleichwertige Statusmodelle
sind zulässig, wenn ihre Bedeutung eindeutig ist.

## Freigabe der Implementierung

- [ ] Kritische Invarianten, Systemgrenzen und Failure Modes sind beschrieben.
- [ ] Jede kritische Invariante besitzt eine konkrete Nachweisplanung oder eine ausdrücklich akzeptierte Restrisikoentscheidung.
- [ ] Es existieren keine unbekannten oder unzugeordneten kritischen Planungs- oder Modelllücken.
- [ ] Verbleibende Nachweislücken sind transparent als noch auszuführende Evidenz ausgewiesen.

## Merge-Entscheidung

- [ ] Jede kritische Invariante besitzt ausgeführte direkte Evidenz für den exakten HEAD oder eine ausdrücklich akzeptierte Restrisikoentscheidung.
- [ ] Jeder nicht-terminale Zustand besitzt einen Konvergenz- oder Recovery-Pfad.
- [ ] Alle bekannten Eintritts-, Dispatch- und Execution-Grenzen sind erfasst.
- [ ] Teilfehler, Konkurrenz, Redelivery, Prozessabbruch und Wiederanlauf sind bewertet.
- [ ] Nicht automatisierbare Annahmen sind reproduzierbar geprüft oder als Restrisiko entschieden.
- [ ] Es existieren keine unbekannten oder unzugeordneten Nachweislücken.
```

## Mögliche Arbeitsweise

Die Reihenfolge ist ein Ausgangspunkt. Sie darf an Liefermodell, Risiko und
vorhandene Artefakte angepasst werden, solange kritische Annahmen nicht
unbemerkt zwischen Planung, Umsetzung und Merge verloren gehen.

1. Invarianten und Grenzen vor dem ersten Implementierungsblock formulieren.
2. Verletzungsszenarien und Failure Modes unabhängig von der geplanten
   Implementierung sammeln.
3. Für jede Invariante die kleinstmögliche direkte Evidenz konkret planen.
4. Tests und Fehlerinjektion parallel zu den betroffenen Lieferabschnitten
   implementieren.
5. Neue Review-, CI- oder Betriebsbefunde zuerst dem Invariantenregister
   zuordnen. Wiederholte Befunde derselben Invariante lösen eine vollständige
   Prüfung ihres Zustandsraums und aller Verbraucher aus.
6. Vor dem Merge den Assurance Case gegen den exakten HEAD und die tatsächlich
   vorhandenen Nachweise prüfen.

## Abgrenzung zu Reviews und CI

Reviews dürfen neue Gegenbeispiele finden und die Qualität der Evidenz
bewerten. Sie dürfen jedoch nicht aus dem Ausbleiben weiterer Findings auf
Vollständigkeit schließen. CI führt die definierten Nachweise reproduzierbar
aus, entscheidet aber nicht, ob die Menge der Invarianten vollständig ist.

Die fachliche Merge-Entscheidung bleibt beim Menschen. Bei kritischen
Invarianten darf sie fehlende Evidenz nicht durch einen sonst grünen
Check-Status ersetzen; Art und Umfang der erforderlichen Evidenz werden jedoch
für den konkreten Risikofall festgelegt.
