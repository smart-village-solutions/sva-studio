## Kontext
Die fuehrende Inhaltsliste in Studio liest Mainserver-basierte Inhaltstypen ueber eine persistierte Projektionsquelle.
Heute wird diese Projektion nach jeder erfolgreichen Mutation mit `force: true` fuer den gesamten Inhaltstyp neu aufgebaut.
Dieser Vollrefresh ist fuer Initialbefuellung und periodische Reconciliation geeignet, aber fuer Einzelmutationen unverhaeltnismaessig teuer.

Zusaetzlich ist die heutige Projektionspersistenz nicht strikt genug auf den Credential- und Account-Kontext zugeschnitten.
In Organisation-Kontexten koennen Projektionszeilen und Sync-State zwischen Accounts derselben Organisation geteilt werden, obwohl die Mainserver-Credentials pro Account oder pro effektivem Credential-Pfad variieren koennen.
Dadurch ist nicht garantiert, dass ein sichtbarer Snapshot genau zu den Credentials des aktuellen Accounts passt.

## Ziele und Nicht-Ziele
- Ziele
  - Persistierte Mainserver-Projektionen muessen pro Account und effektivem Scope isoliert sein
  - Die Liste muss immer aus einer vorhandenen Projektion rendern koennen, auch wenn diese veraltet ist
  - Nach Login oder Session-Aufbau muessen die neuesten Datensaetze aller relevanten Mainserver-Typen zuerst und paginiert nachgeladen werden
  - Einzelmutationen muessen die Listenprojektion nur fuer den betroffenen Datensatz aktualisieren
  - Bestehende Scope-, Credential- und Mapping-Semantiken bleiben unveraendert
  - Reconciliation fuer Drift und externe Aenderungen bleibt moeglich, aber nicht als Standardpfad fuer die Listenfrische
- Nicht-Ziele
  - Browserseitiger Direktzugriff auf Mainserver-Listen
  - Unbegrenzter Vollimport aller historischen Daten vor erster Listenanzeige
  - Aenderung der inhaltlichen Mainserver-Mutationssemantik

## Entscheidungen
- Entscheidung: Projektionsscope wird account-spezifisch und credential-sensitiv definiert
  - Persistierte Projektion, Sync-State und Deduplizierung verwenden denselben Scope-Vertrag.
  - Der Scope enthaelt verbindlich `instanceId`, `actorAccountId`, `activeOrganizationId` und `contentType`.
  - Zwei Accounts duerfen weder Projektionszeilen noch Sync-State miteinander teilen, auch wenn sie derselben Organisation angehoeren.
  - Diese Scope-Definition ist im aktuellen Modell ausreichend: User-Credentials werden effektiv ueber `keycloakSubject + instanceId` gelesen, `actorAccountId` wird pro Instanz eindeutig aus diesem Subject aufgeloest, und Organisation-Credentials werden ueber `activeOrganizationId` separiert.
- Entscheidung: Die Liste liest immer aus der persistierten Projektion
  - Die Tabellenansicht bleibt lesbar, selbst wenn die Projektion veraltet ist.
  - Ein laufender Refresh aktualisiert den Snapshot im Hintergrund, statt die Tabelle bis zur Vollstaendigkeit zu blockieren.
- Entscheidung: Login-naher Hintergrund-Refresh laedt zuerst die neuesten Seiten aller Typen
  - Nach Login oder beim Aufbau des relevanten Session-Kontexts startet der Host einen asynchronen Refresh fuer die sichtbaren Mainserver-Typen.
  - Es gibt keine Priorisierung zwischen News, Events und POI.
  - Fuer jeden Typ wird zunaechst die erste Seite mit `pageSize = 25` und Sortierung `updatedAt DESC` geladen und persistiert.
  - Der initiale Rollout arbeitet konservativ sequentiell, um Studio und Mainserver nicht durch parallele Login-Refreshes zu ueberlasten.
  - Erst wenn fuer alle betroffenen Typen die erste Seite geschrieben oder zumindest versucht wurde, duerfen aeltere Seiten derselben Typen weitergeladen werden.
- Entscheidung: Aeltere Daten werden progressiv paginiert statt als frueher Vollrefresh geladen
  - Der Refresh arbeitet seitenweise und typuebergreifend weiter, also zuerst alle ersten Seiten, dann alle zweiten Seiten und so weiter.
  - Der Lauf setzt sich auch dann fort, wenn der Nutzer die Inhaltsliste nicht oeffnet.
  - Der Refresh arbeitet weiter, bis das Ende des Upstream-Bestands erreicht ist.
  - Dadurch werden die juengsten und fuer die Default-Sortierung wichtigsten Daten zuerst verfuegbar.
- Entscheidung: Create und Update nutzen einen gezielten Detail-Read nach erfolgreicher Mutation
  - Nach erfolgreicher Mainserver-Mutation laedt der Host den betroffenen Datensatz ueber den bereits spezifizierten typed Detail-Adapter nach.
  - Wenn der Upstream-Zustand unmittelbar nach der Mutation noch nicht verarbeitbar ist, darf der Host fuer kurze Zeit einen begrenzten Retry ausfuehren.
  - Die Projektionspersistenz fuehrt fuer diesen Datensatz ein gezieltes Upsert aus, statt alle Zeilen des Typs zu ersetzen.
- Entscheidung: Delete entfernt gezielt die betroffene Projektionszeile
  - Da geloeschte Datensaetze nicht mehr per Detail-Read verfuegbar sind, wird die Projektionszeile anhand von `source_entity_type` und `source_entity_id` geloescht.
  - Der Loeschpfad darf keinen typweiten Neuaufbau ausloesen.
- Entscheidung: Reconciliation bleibt seltenes Safety-Net statt primaerer Poll-Pfad
  - Der bestehende Poll-/Stale-Mechanismus wird fachlich auf einen Reconciliation-Zweck reduziert.
  - Ein Fehler in der gezielten Projektionsaktualisierung markiert die Mutation nicht rueckwirkend als fachlich fehlgeschlagen.
  - Die Standardfrische der Liste wird ueber Login-nahen progressiven Refresh und direkte Mutations-Nachsynchronisation sichergestellt, nicht ueber starre Fuenf-Minuten-Polls.
- Entscheidung: Fallback nur bei nicht deterministisch behebbaren Inkonsistenzen
  - Wenn ein gezielter Detail-Read nach Mutation unerwartet keine verarbeitbare Antwort liefert, fuehrt das System zunaechst einen kurzen begrenzten Retry aus, protokolliert danach den Fehler deterministisch und verlaesst sich anschliessend auf den naechsten Vollabgleich.
  - Der Fallback ist Ausnahme, nicht Standardpfad.
  - Falls `actorAccountId` im Mutationspfad wider Erwarten nicht aufgeloest werden kann, bleibt die Mutation fachlich erfolgreich, der Projektions-Refresh wird ausgelassen und der Vorfall deterministisch protokolliert.

## Risiken und Gegenmassnahmen
- Risiko: Scope-Isolation wird nur teilweise umgesetzt
  - Gegenmassnahme: Scope-Schluessel fuer Persistenz, Sync-State, Deduplizierung und Loeschpfade zentral ableiten und gemeinsam testen.
- Risiko: Hintergrund-Refresh wird zwar progressiv, startet aber zu spaet
  - Gegenmassnahme: den Refresh an einen klaren Login-/Session-Hook anbinden und den Trigger im Test explizit abdecken.
- Risiko: Der konservativ sequentielle Login-Refresh braucht bei vielen sichtbaren Typen oder grossen Bestaenden zu lange
  - Gegenmassnahme: keine Typ-Priorisierung, saubere Observability fuer Seitentiefe und Laufzeit sowie spaetere kontrollierte Parallelisierung nur bei gemessenem Bedarf.
- Risiko: Detail-Nachladen nach erfolgreicher Mutation liefert einen noch nicht sichtbaren Upstream-Zustand
  - Gegenmassnahme: kurzer begrenzter Retry, danach gezielte Fehlerklassifikation; keine Rueckabwicklung der Mutation, periodische Reconciliation bleibt aktiv.
- Risiko: Scope-Zuordnung der Projektionszeile weicht vom Vollrefresh-Verhalten ab
  - Gegenmassnahme: gezielter Pfad verwendet dieselbe Mapping- und Scope-Logik wie der bestehende Vollrefresh.
- Risiko: Delete entfernt zu breit
  - Gegenmassnahme: Loeschung erfolgt ueber die bekannte Entity-Identitaet und denselben Projektions-Scope wie die Mutation.

## Migrations- und Rollout-Plan
- Schritt 1: Projektions- und Sync-State-Schema auf account-isolierte Scope-Schluessel erweitern
- Schritt 2: Lese-, Deduplizierungs- und Persistenzpfade auf den neuen Scope zentral umstellen
- Schritt 3: Login-nahen progressiven Refresh fuer erste Seiten aller sichtbaren Typen einfuehren
  - initial konservativ sequentiell und bis zum Ende des Upstream-Bestands laufend
- Schritt 4: Mutationspfade fuer News, Events und POI auf gezielte Nachsynchronisation umstellen
  - inklusive defensivem Verhalten bei fehlender `actorAccountId` und kurzem Retry fuer verzögert sichtbare Upstream-Details
- Schritt 5: Reconciliation-Pfad auf seltene Drift- und Fehlerfaelle begrenzen
- Schritt 6: Regressionstests fuer Scope-Isolation, progressive Pagination, stale Anzeige sowie Create, Update, Delete und Fehlerfallback absichern

## Offene Fragen
- Ob Reconciliation weiterhin zeitgesteuert laeuft oder nur ereignisbasiert und selten manuell/operativ ausgelost wird, kann in der Implementierung als konservativer Zwischenschritt entschieden werden, solange sie nicht mehr der primaere Listenfrische-Pfad ist.
