## Kontext
Die fuehrende Inhaltsliste in Studio liest Mainserver-basierte Inhaltstypen ueber eine persistierte Projektionsquelle.
Heute wird diese Projektion nach jeder erfolgreichen Mutation mit `force: true` fuer den gesamten Inhaltstyp neu aufgebaut.
Dieser Vollrefresh ist fuer Initialbefuellung und periodische Reconciliation geeignet, aber fuer Einzelmutationen unverhaeltnismaessig teuer.

## Ziele und Nicht-Ziele
- Ziele
  - Einzelmutationen muessen die Listenprojektion nur fuer den betroffenen Datensatz aktualisieren
  - Bestehende Scope-, Credential- und Mapping-Semantiken bleiben unveraendert
  - Der periodische Vollabgleich bleibt als Safety-Net fuer Drift und externe Aenderungen erhalten
- Nicht-Ziele
  - Abschaffung der periodischen Reconciliation
  - Neue Mainserver-Snapshot- oder Caching-Strategien fuer komplette Typen
  - Aenderung der inhaltlichen Mainserver-Mutationssemantik

## Entscheidungen
- Entscheidung: Create und Update nutzen einen gezielten Detail-Read nach erfolgreicher Mutation
  - Nach erfolgreicher Mainserver-Mutation laedt der Host den betroffenen Datensatz ueber den bereits spezifizierten typed Detail-Adapter nach.
  - Die Projektionspersistenz fuehrt fuer diesen Datensatz ein gezieltes Upsert aus, statt alle Zeilen des Typs zu ersetzen.
- Entscheidung: Delete entfernt gezielt die betroffene Projektionszeile
  - Da geloeschte Datensaetze nicht mehr per Detail-Read verfuegbar sind, wird die Projektionszeile anhand von `source_entity_type` und `source_entity_id` geloescht.
  - Der Loeschpfad darf keinen typweiten Neuaufbau ausloesen.
- Entscheidung: Vollabgleich bleibt Reconciliation-Pfad
  - Der bestehende Poll-/Stale-Mechanismus bleibt fuer externe Mainserver-Aenderungen und Fehlerfaelle bestehen.
  - Ein Fehler in der gezielten Projektionsaktualisierung markiert die Mutation nicht rueckwirkend als fachlich fehlgeschlagen.
- Entscheidung: Fallback nur bei nicht deterministisch behebbaren Inkonsistenzen
  - Wenn ein gezielter Detail-Read nach Mutation unerwartet keine verarbeitbare Antwort liefert, protokolliert das System den Fehler deterministisch und verlaesst sich auf den naechsten Vollabgleich.
  - Der Fallback ist Ausnahme, nicht Standardpfad.

## Risiken und Gegenmassnahmen
- Risiko: Detail-Nachladen nach erfolgreicher Mutation liefert einen noch nicht sichtbaren Upstream-Zustand
  - Gegenmassnahme: gezielte Fehlerklassifikation, keine Rueckabwicklung der Mutation, periodische Reconciliation bleibt aktiv.
- Risiko: Scope-Zuordnung der Projektionszeile weicht vom Vollrefresh-Verhalten ab
  - Gegenmassnahme: gezielter Pfad verwendet dieselbe Mapping- und Scope-Logik wie der bestehende Vollrefresh.
- Risiko: Delete entfernt zu breit
  - Gegenmassnahme: Loeschung erfolgt ueber die bekannte Entity-Identitaet und denselben Projektions-Scope wie die Mutation.

## Migrations- und Rollout-Plan
- Schritt 1: gezielte Projektionsoperationen fuer Upsert und Delete einfuehren
- Schritt 2: Mutationspfade fuer News, Events und POI auf gezielte Nachsynchronisation umstellen
- Schritt 3: bestehende periodische Reconciliation unveraendert weiterlaufen lassen
- Schritt 4: Regressionstests fuer Create, Update, Delete und Fehlerfallback absichern

## Offene Fragen
- Soll der gezielte Pfad bei transienten Mainserver-Detailfehlern sofort einen asynchronen Hintergrundjob anstossen oder ausschliesslich auf den regulaeren Poll-Zyklus vertrauen?
