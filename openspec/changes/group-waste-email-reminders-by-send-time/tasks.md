## 1. Planer und Versandinhalt

- [ ] Die vorhandene Termin- und Slotberechnung wiederverwenden. Die fachlichen Mitglieder nach Abo, wirksamem Datum und berechnetem ursprünglichem Versandzeitpunkt gruppieren.
- [ ] Den bestehenden Payload- und Rendering-Pfad um validierte Gruppenmitglieder erweitern. Alte Einzelaufträge, Vorlagenplätze und Abmeldelink mitprüfen.
- [ ] Mehrere Fraktionen und den ungeklärten Versandstatus in der bestehenden Versandübersicht verständlich abbilden.

## 2. Umschaltung und Ausführungsgrenzen

- [ ] Im bestehenden Outbox-Abgleich sicher wartende Altaufträge und Gruppen atomar umstellen. Gesendete, bereits beanspruchte beziehungsweise ungeklärte Mitglieder schützen.
- [ ] Bei Retry die ursprüngliche Gruppenidentität bewahren. Definitiven Nichtversand und ungeklärten Ausgang am Dispatcher unterscheiden und dieselbe Mitgliedschaft über einen Wechsel der Auftragsform hinweg berücksichtigen.
- [ ] Vor einer Provider-Übergabe den aktuellen Abozustand erneut prüfen. Einen Widerruf bei ausstehenden, geclaimten und erneut versuchten Aufträgen testen.
- [ ] Den Übergang dokumentieren und nachweisen, dass alte Worker beendet sind, bevor Gruppen materialisiert werden. Auftragszustände und Mitgliedschaft vor und nach der Umschaltung unabhängig lesen.

## 3. Nachweise und Dokumentation

- [ ] Planertests für identisches und verschiedenes `sendAt`, wirksame Verschiebungen, mehrere Slots und verschiedene Abholtage ergänzen.
- [ ] PostgreSQL- und Transporttests für Wiederholung, parallele Leases, Transaktionsabbruch, definitive Ablehnung, verlorene Providerantwort, Abmeldung und Übergang vom Einzelauftrag ausführen.
- [ ] Rendern und Monitoring für alte und neue Aufträge mit den betroffenen Fraktionen prüfen. DOI-/Push-Bestandspfad per gezielten Regressionstests absichern.
- [ ] [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [Querschnittskonzepte](../../../docs/architecture/08-cross-cutting-concepts.md) beim vorhandenen Versandpfad aktualisieren. Die Betriebsentscheidung für ungeklärte Fälle vor der Auslieferung festhalten.
