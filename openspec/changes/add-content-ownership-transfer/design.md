## Context

Studio unterscheidet zwischen dem tatsächlich handelnden Account, dem persönlichen oder organisatorischen Mutationsprincipal, der Credential-Quelle, technischer IAM-Ownership und dem Mainserver-DataProvider. Bei lokalen Inhalten sind `ownerUserId` und `ownerOrganizationId` die technische Zuständigkeit; die sichtbare Autorenanzeige ist davon getrennt. Bei Mainserver-Inhalten ist der DataProvider dagegen fachlicher Inhaber und sichtbare Autorenidentität, während die lokalen Owner-Felder nur eine rekonstruierbare Projektion einer verifizierten Principal-Bindung sind.

Der aktuelle Studio-Vertrag behandelt den Mainserver-DataProvider als unveränderlich und lässt lokale Ownership-Änderungen über normale Update-Rechte zu. Issue #1102 verlangt dagegen eine separate Permission für die bewusste Übergabe an Accounts oder Organisationen. Der Mainserver-Commit `ee619d0e` ergänzt dafür `dataProviderId` auf den fünf primären Resource-Mutationen, begrenzt die Auswahl auf Management-Rollen und dieselbe Municipality und führt abhängige Datensätze sowie `ExternalReference` transaktional mit.

## Goals

- Eine bewusste, einzeln bestätigte Übergabe an einen aktiven Account oder eine aktive Organisation derselben Instanz ermöglichen.
- Inhabertransfer strikt von normaler Inhaltsbearbeitung, Principal-Auswahl und Identitäts-Reconciliation trennen.
- Ziel-Principal, DataProvider-Bindung und Credentials ausschließlich serverseitig und fail-closed auflösen.
- Den bestätigten Mainserver-Zustand als fachliche Wahrheit behandeln und lokale Projektion, Journal und Audit zuverlässig nachziehen.
- Einen unklaren Transportausgang ohne doppelten oder erfundenen Transfer klären können.
- Einen gemeinsamen UI-Vertrag für die aktuelle Inhaberanzeige bei möglichst allen Content-Typen und für die Transferaktion bei unterstützten Typen bereitstellen.

## Non-Goals

- Kein Bulk-Transfer, kein Tenant-Transfer und keine Übergabe zwischen Mainserver-Instanzen oder Municipalities.
- Kein Transfer von Credentials, Memberships, Rollen oder Account-Identitäten.
- Keine automatische Übergabe als Nebeneffekt anderer Lifecycle- oder IAM-Ereignisse.
- Kein generischer Transfer für Typen ohne bestätigten Mainserver-Vertrag.
- Kein Ersatz für `add-mainserver-user-conflict-reconciliation`.

## Decisions

### Eine eigene Action autorisiert ausschließlich den aktuellen Inhalt

`content.transferOwnership` ist eine tenantweite, scope-fähige und vollständig qualifizierte Action. Ihr Scope wird gegen den aktuellen Inhaber des Quellinhalts ausgewertet. `own`, `organization` und `all` behalten ihre bestehende Bedeutung; der Zielbereich ist ein Validierungsziel und keine zusätzliche Leseberechtigung, die der Actor bereits besitzen muss.

Normale Actions wie `content.updateMetadata` oder pluginspezifische Update-Actions reichen für eine Übergabe nicht aus. Der Server prüft die Transfer-Action unmittelbar vor jedem Seiteneffekt erneut. `system_admin` erhält sie über den kanonischen Permission-Katalog mit Scope `all`; weitere Rollen erhalten sie nur durch explizite Konfiguration.

### Der Browser wählt einen Principal und niemals einen DataProvider

Der Client sendet genau einen `targetPrincipal` mit `type = account | organization` und einer UUID. Der Server validiert Instanz, Aktivstatus und zulässigen Principal-Typ. Für Mainserver-Inhalte verlangt er verwendbare persönliche oder organisatorische Credentials und löst eine aktuelle, konfliktfreie Eins-zu-eins-Bindung vom Principal zum DataProvider serverseitig auf.

Fehlt für eine verwendbare Credential-Version lediglich die gespeicherte Bindung, darf der Zielkatalog den Principal als `verification_required` anbieten. Erst nach ausdrücklicher Transferbestätigung prüft der Server genau dieses Ziel über `/data_provider.json`, persistiert die authentifizierte Beobachtung und löst die Bindung erneut auf. Das Blättern oder Suchen im Zielkatalog löst keine externen Identity-Aufrufe je Treffer aus. Mehrdeutige, konfliktbehaftete, instanzfremde, gelöschte oder credential-lose Ziele werden nicht angeboten und bei direktem Request serverseitig abgewiesen. Eine vom Browser gelieferte DataProvider-ID gehört nicht zum Request-Schema.

### Lokale und Mainserver-basierte Inhalte besitzen getrennte Transferadapter

Lokale Inhalte ändern `ownerUserId` beziehungsweise `ownerOrganizationId` atomar im bestehenden Repository. Beim Wechsel auf eine Organisation wird der persönliche Owner entfernt; beim Wechsel auf einen Account wird der Organisations-Owner entfernt. Die sichtbare redaktionelle Autorenanzeige bleibt unverändert.

Mainserver-Inhalte werden nicht durch eine lokale Owner-Umschreibung übertragen. Der typisierte Adapter sendet die serverseitig aufgelöste Ziel-DataProvider-ID an die bestehende Resource-Mutation. Erst der bestätigte Mainserver-Response oder ein eindeutiger Target-Re-Read begründet den neuen Inhaber. Anschließend werden Binding-basierte Owner-Projektion, Credential-Quelle, Liste und History nachgezogen.

### V1 verwendet eine explizite Typmatrix

V1 aktiviert den Transfer nur für:

- NewsItem,
- EventRecord,
- PointOfInterest,
- Tour im bestätigten Upstream-Vertrag; ohne vorhandenen redaktionellen Studio-Editor keine V1-Aktivierung,
- Root-GenericItem einschließlich der vom Mainserver mitgeführten abhängigen GenericItems, TourStops und POI-Voucher.

Fachplugins auf Basis eines Root-GenericItems verwenden denselben Host-Vertrag. Touren werden erst bei Einführung eines redaktionellen Studio-Editors an den bereits bestätigten Vertrag angebunden; dafür wird jetzt kein ungenutzter Adapter gepflegt. Surveys, Legacy SurveyPolls, Batch-Importe und alle weiteren Typen bleiben deaktiviert, bis ihr vollständiger Transfer- und Abhängigkeitsvertrag separat bestätigt ist. `content.transferOwnership` gehört für die bestätigten Studio-Typen dauerhaft zu den Code-Capabilities und besitzt keinen betrieblichen Konfigurationsschalter. Die UI leitet Verfügbarkeit aus dieser serverseitigen Capability-Matrix ab und führt keine eigene Typenliste.

### Der autorisierte Actor führt aus, der Target-Principal übernimmt

Der tatsächlich handelnde und für den Quellinhalt autorisierte Actor führt Fresh Pre-Read und Transfermutation mit seinen Management-Credentials aus. Bei Scope `all` ist eine aktuelle Bindung des bisherigen Source-DataProviders an einen aktiven Studio-Principal weder für die Autorisierung noch für den Write erforderlich. Bei `own` oder `organization` wird sie nur soweit benötigt, wie sie den engeren Source-Scope nachweist. Der Ziel-Principal liefert keine Browser-Credentials und wird nicht zum Actor. Nach erfolgreicher Übergabe bestimmen Zielbindung und Ziel-Credentials alle späteren Mutationen.

Der Server sperrt den Content-/DataProvider-Pfad während Reservierung und Finalisierung, prüft Transfer-Permission, Quell-Preimage, Zielbindung und Upstream-Capability erneut und reserviert eine stabile Operationsreferenz im bestehenden Mutationsjournal.

### Unklare Ergebnisse werden durch Actor und Target geklärt

Bei Timeout oder Verbindungsabbruch liest Studio den Datensatz zuerst mit den Ziel-Credentials und anschließend mit den Credentials des autorisierten Actors:

- bestätigt der Target-Re-Read die Ziel-DataProvider-ID, wird der Transfer als erfolgreich finalisiert;
- bestätigt der Actor-Re-Read weiterhin ausschließlich den Quell-DataProvider, darf dieselbe Operationsreferenz kontrolliert wiederholt werden;
- liefern die Reads widersprüchliche, fehlende oder nicht eindeutige Evidenz, bleibt der Vorgang `reconciliation_required` und eine weitere automatische Mutation ist gesperrt.

Lokale Folgefehler nach bestätigtem Provider-Erfolg ändern den fachlichen Erfolg nicht. Sie werden als Reconciliation-Bedarf nachgezogen und nicht als Mainserver-Rollback dargestellt.

### Der sichtbare Autor folgt dem jeweiligen Fachmodell

Bei lokalen Inhalten bleibt die Autorenanzeige trotz Ownership-Transfer stabil. Bei Mainserver-Inhalten ist der aktuelle DataProvider gleichzeitig fachlicher Inhaber und sichtbare Autorenidentität; ein bestätigter Transfer ändert daher beide gemeinsam. Die UI weist diese Wirkung vor der Bestätigung ausdrücklich aus.

### Der aktuelle Datensatz bestimmt den angezeigten Inhaber

Die Inhaberanzeige verwendet bei Mainserver-Inhalten ausschließlich den `dataProvider` des frisch gelesenen Datensatzes. Sie rekonstruiert den aktuellen Inhaber weder aus Audit-Ereignissen noch aus History, Actor, aktivem Organisationskontext, Credential-Quelle oder einer möglicherweise veralteten lokalen Owner-Projektion. Eine konfliktfreie Principal-Bindung ergänzt den DataProvider um die verständliche Einordnung „Persönlicher Account“ oder „Organisation“, begründet aber nicht den DataProvider selbst.

Ist der DataProvider vorhanden, aber keinem Studio-Principal eindeutig zugeordnet, zeigt die Oberfläche weiterhin seinen verfügbaren Anzeigenamen und kennzeichnet die fehlende eindeutige Zuordnung. Sie erfindet keinen Inhaber. Mit `content.transferOwnership` und Scope `all` bleibt die Transferaktion verfügbar; bei `own` oder `organization` bleibt die eindeutige Zuordnung für den Nachweis des engeren Source-Scopes erforderlich.

Bei lokalen Inhalten stammt der aktuelle Inhaber aus genau einem der beiden technischen Owner-Felder. Ein ownerloser lokaler Datensatz wird als „Kein Inhaber zugeordnet“ angezeigt und kann ausschließlich mit `content.transferOwnership` und Scope `all` zugewiesen werden.

### Inhaberanzeige und Mutationsprincipal sind getrennte UI-Konzepte

Die bestehende Auswahl „Bearbeiten als“ steuert den Mutationsprincipal und die Credential-Quelle. Sie ist keine Inhaberanzeige. Ein gemeinsamer `ContentOwnershipPanel`-Vertrag in `@sva/studio-ui-react` stellt dagegen ausschließlich aktuellen Inhaber, Inhabertyp, Transferfähigkeit und Ownership-Hinweise dar. Er verwendet vorhandene Detailkarten-, Feld- und shadcn/ui-Primitives und dupliziert keine pluginlokale Basis-UI.

Der Inhaberbereich steht im Bearbeitungsmodus genau einmal und am Anfang des ersten fachlichen Tabs des jeweiligen Inhaltstyps, üblicherweise „Basis“. Das gilt einheitlich für die vorhandenen Editoren für News, Events, POI, generische Inhalte, FAQ, Cockpit Cards, Featured Projects und Surveys, auch wenn ein Typ noch keinen Transfer unterstützt. Im Erstellungsmodus gibt es noch keinen bisherigen Inhaber; dort bleibt nur die getrennte Auswahl des Erstellungsprincipals sichtbar. Künftige Content-Editoren, einschließlich einer möglichen Tour-Detailansicht, müssen denselben First-Tab-Slot verwenden.

### Normales Speichern kommuniziert den unveränderten Inhaber

Der Inhaberbereich erklärt dauerhaft und nicht blockierend, dass normale Inhaltsbearbeitung keinen neuen Inhaber erzeugt. Derselbe Sachverhalt wird kompakt in der Nähe der Speichern-Aktion wiederholt, damit er auch beim Speichern aus einem anderen Tab wahrnehmbar bleibt. Ein wiederkehrender Bestätigungsdialog bei jedem normalen Speichern ist nicht vorgesehen.

- Ohne effektives Transferrecht lautet die Aussage sinngemäß: „Speichern ändert den Inhaber nicht. Du kannst den Datensatz bearbeiten, aber nicht übertragen.“
- Mit effektivem Transferrecht verweist sie zusätzlich auf „Inhalt übertragen“ als getrennten Vorgang.
- Weicht der Mutationsprincipal vom Inhaber ab, nennt die Oberfläche beide Rollen ausdrücklich: „Bearbeitung erfolgt als …; Inhaber bleibt …“.

Diese Hinweise werden lokalisiert und aus Berechtigung, Capability und aktuellem Inhaberzustand abgeleitet; Plugins formulieren keine eigenen Varianten.

### Die UI verwendet eine gemeinsame bestätigungspflichtige Aktion

Ein gemeinsamer Host-Baustein liefert Trigger, Zielsuche, Zielzusammenfassung, Bestätigung, Lade-/Fehlerzustände und Erfolgsfeedback. Plugins tragen nur Content-Typ, Content-Identität und den First-Tab-Slot bei. Permission und Transfer-Capability kommen vom Server. Nicht autorisierte Inhalte zeigen keine aktive Transferaktion und erklären im normalen Bearbeitungshinweis das fehlende Übertragungsrecht. Nicht unterstützte Inhalte zeigen den aktuellen Inhaber, aber statt einer aktiven Aktion den Hinweis „Übertragung für diesen Inhaltstyp noch nicht verfügbar“.

Die serverseitig paginierte Zielauswahl trennt „Persönliche Accounts“ und „Organisationen“ durch einen expliziten Filter. Organisationen können über ihre nicht verschlüsselte Anzeige gesucht werden. Persönliche Accounts werden in V1 ausschließlich paginiert angeboten; eine zusätzliche Suche über verschlüsselte Namens- oder E-Mail-Felder wird nicht eingeführt. Die Oberfläche benötigt für Kandidatenlisten keine garantierte exakte Gesamtzahl, solange Vorwärts- und Rückwärtsnavigation keine verfügbaren Treffer ausblendet. Jeder Treffer besitzt eine textliche Typkennzeichnung und einen Anzeigenamen; technische DataProvider-IDs und E-Mail-Adressen werden nicht angezeigt. Der aktuelle Inhaber, inaktive, gelöschte, konfliktbehaftete oder credential-lose Principals sind nicht auswählbar. Kandidaten mit verwendbaren Credentials, aber noch fehlender Bindung, kennzeichnet die Oberfläche verständlich als Ziel, dessen DataProvider-Zuordnung beim bestätigten Transfer sicher geprüft wird.

Vor der Mutation zeigt ein eigener Prüfschritt „Aktueller Inhaber → Neuer Inhaber“ mit Typ und Name. Bei Mainserver-Inhalten weist er darauf hin, dass damit auch die sichtbare Autorenidentität wechselt; bei lokalen Inhalten bleibt diese unverändert. Zusätzlich warnt er vor einem möglichen Verlust des anschließenden Zugriffs und verlangt eine eindeutige Bestätigung. Fokusführung, Tastaturbedienung, Screenreader-Beschriftung und lokalisierte Meldungen folgen den vorhandenen shadcn/ui- und Action-Feedback-Verträgen.

Nach bestätigtem Erfolg zeigt die Oberfläche zuerst das Erfolgsfeedback und lädt anschließend den aktuellen Inhaber neu. Verliert der Actor dadurch den Detailzugriff, navigiert sie erst nach der Erfolgsmeldung in die Inhaltsliste; ein anschließender 403 oder 404 widerruft den Erfolg nicht.

### Audit ist Nachweis der Studio-Vorgänge, keine vollständige Inhaberhistorie

Das Audit erfasst jeden vom Studio angeforderten Transfer und kennzeichnet seine Abdeckung als `studio_mutations`. Da Inhalte und DataProvider außerhalb des Studios verändert werden können, darf die Oberfläche daraus keine vollständige Abfolge früherer Inhaber behaupten. Eine optionale History-Darstellung trägt deshalb den Hinweis, dass externe Änderungen fehlen können.

Der aktuelle Inhaber wird nie aus dieser Historie rekonstruiert. Liefert ein späterer Fresh Read einen anderen DataProvider als die lokale Projektion oder das letzte Studio-Audit, ist der aktuelle DataProvider maßgeblich; Projektion und Reconciliation werden entsprechend nachgezogen, ohne ein nicht beobachtetes Transferereignis zu erfinden.

### Einheitlichkeit wird zentral und durch Konformitätstests abgesichert

Der gemeinsame Inhaberbaustein und eine serverseitige Capability-Matrix verhindern abweichende pluginlokale Semantik. Konformitätstests prüfen für jeden registrierten Content-Editor, dass die Inhaberanzeige im Bearbeitungsmodus genau einmal im ersten Tab erscheint, der Save-Hinweis vorhanden ist und die Transferaktion ausschließlich bei wirksamer Permission und positiver Capability aktiv ist. Für Typen ohne bestehenden Studio-Editor gilt der Vertrag ab Einführung ihrer Detailansicht; die Mainserver-Transferfähigkeit allein behauptet noch keine vorhandene UI.

## Error Contract

Der Server liefert stabile, PII-arme Fehlercodes mindestens für:

- `content_transfer_permission_missing`,
- `content_transfer_target_invalid`,
- `content_transfer_target_binding_missing`,
- `content_transfer_target_binding_conflict`,
- `content_transfer_target_credentials_missing`,
- `content_transfer_target_verification_failed`,
- `content_transfer_type_unsupported`,
- `content_transfer_source_changed`,
- `content_transfer_provider_rejected`,
- `content_transfer_reconciliation_required`.

Antwort, Audit und Logs enthalten keine E-Mail-Adressen, Credential-Inhalte, Tokens oder vollständigen Mainserver-Responses.

## Risks and Mitigations

- Übergabe an einen falschen Principal → serverseitig gefilterte Zielauswahl, klare Typkennzeichnung, Wirkungszusammenfassung und explizite Bestätigung.
- Actor verliert nach erfolgreicher Übergabe den Zugriff → Erfolg wird aus dem bestätigten Transferzustand angezeigt; ein anschließender 403/404 widerruft den Erfolg nicht.
- Mainserver-Vertrag ist noch nicht auf dem Zielsystem verfügbar → Der geschützte Rollout blockiert die inkompatible Studio-/Mainserver-Kombination vor der Auslieferung.
- Upstream-Erfolg bei verlorenem Response → Target-/Actor-Re-Read und bestehendes Mutationsjournal verhindern erfundene Rollbacks und unkontrollierte Wiederholungen.
- DataProvider-Bindung ändert sich parallel → DataProvider-Lock, Fresh Validation und erwartete Binding-Version blockieren stale Transfers.
- Unterschiedliche Typverträge oder Editorstrukturen → zentrale Capability-Matrix, gemeinsamer First-Tab-Vertrag und Konformitätstests statt pluginlokaler Sonderwege.

## Migration Plan

1. Den Mainserver-Vertrag und seine Verfügbarkeit in Dev/Staging für alle fünf V1-Typen verifizieren und den Studio-Schema-Snapshot aktualisieren.
2. Permission-Katalog, System-Admin-Reconcile, lokale Transferautorisierung und Audit einführen.
3. Zielauflösung, typisierte Mainserver-Adapter, Journal-/Reconciliation-Pfad und Projektion implementieren.
4. Gemeinsame UI-Aktion und Plugin-Capabilities für die V1-Typen aktivieren.
5. Bestehende Test-Principals mit fehlender `studio`-Rolle gezielt reprovisionieren und die vollständige Transfermatrix in Dev/Staging abnehmen.
6. Studio und erforderliche Mainserver-Version nach positivem Vertragsnachweis über ihre jeweiligen geschützten Rolloutpfade ausrollen; die bestätigte Transfer-Capability benötigt danach keinen Laufzeitschalter.

## Open Questions

Keine offenen Produktentscheidungen für V1. Erweiterungen um Bulk-Transfer, Surveys oder weitere Mainserver-Typen benötigen einen eigenen bestätigten Vertrag.
