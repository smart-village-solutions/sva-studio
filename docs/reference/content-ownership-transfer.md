# Inhaber von Inhalten übertragen

## Vorübergehende Schutzsperre (2026-11-16)

Der gemeinsame SDK-Service lehnt Mainserver-Inhaberwechsel für alle unterstützten Typen mit HTTP 409 und
`content_transfer_temporarily_disabled` ab. Das gilt für News, Veranstaltungen, POIs und
sämtliche über GenericItems abgebildeten Typen einschließlich FAQ, Cockpit Cards und Projekte.
Die Sperre greift im gemeinsamen SDK-Service vor Konfigurations-, Credential- und Netzwerkzugriffen;
der bisherige Transferadapter mit Inhaltsmutationen wurde entfernt. Lokale Studio-Inhalte sind
von dieser Mainserver-Sperre nicht betroffen. Der HTTP-Orchestrator führt weiterhin seine
Vorprüfungen und Journalführung aus. Scheitern zusätzliche Abgleich-Lesezugriffe, kann seine Antwort
`content_transfer_reconciliation_required` statt der Schutzmeldung enthalten; ein Provider-Write
findet auch dann nicht statt.

Der bisherige Adapter sendete nur Titel und Ziel-DataProvider an eine ersetzende Inhaltsmutation.
Der Mainserver löschte dadurch ausgelassene verschachtelte Datensätze. Ein vollständiges Zurücksenden
der Leseantwort ist kein sicherer Ersatz: Leseabfragen können etwa vergangene Termine ausblenden,
und neu angelegte Beziehungen würden ihre bisherige Identität verlieren.

Der sichere Mainserver-Vertrag wird in [SVA-1790](https://tpwd.atlassian.net/browse/SVA-1790) verfolgt.
Die nachfolgend beschriebene Mainserver-Übertragung bleibt bis zu einer gezielten, transaktionalen
Inhaberwechsel-Mutation außer Betrieb. Eine Wiederfreigabe benötigt einen Nachweis, dass Inhalte,
verschachtelte Beziehungen und deren IDs unverändert erhalten bleiben. Eine bloße Bestätigung des
Ziel-DataProviders reicht nicht aus. Die bestehenden Abgleichpfade dürfen frühere Vorgänge weiterhin
lesend beziehungsweise lokal nachführen, aber keinen neuen Provider-Transfer starten.

## Fachlicher Vertrag

Der aktuelle Inhaber eines Mainserver-Datensatzes ist dessen aktuell gelesener DataProvider. Audit und Historie können Transfers erläutern, sind wegen möglicher externer Änderungen aber nie die Quelle für die aktuelle Anzeige. Bei lokalen Studio-Inhalten ist genau ein persönlicher Account oder eine Organisation als Owner gespeichert.

Normales Bearbeiten und Speichern ändert den Inhaber nicht. Auch ein abweichender Mutationsprincipal („Bearbeiten als“) ist keine Übertragung.

Die wirksame Permission `content.transferOwnership` ist die einzige fachliche Freigabe für eine Übertragung. Mit Scope `all` darf der Actor jeden für ihn sichtbaren und vom Typvertrag unterstützten Inhalt übertragen. Derselbe globale oder kanonisch unscoped Permission-Kandidat muss dabei auch alle Resource-ID-, Organisations- und ABAC-Bedingungen erfüllen; verschiedene Grants werden nicht zu einer Freigabe kombiniert. Der bisherige Inhaber muss dafür weder aktiv noch im Studio eindeutig an einen Principal gebunden sein und benötigt keine verwendbaren Credentials. Bei `own` oder `organization` bleibt eine eindeutige Bindung erforderlich, soweit sie den jeweiligen Source-Scope nachweist.

## Bedienung

Im Bearbeitungsmodus steht der Bereich **Inhaber** am Anfang des ersten fachlichen Tabs. Er zeigt den aktuellen Inhaber und den dauerhaften Save-Hinweis. Nutzer mit wirksamem `content.transferOwnership` können **Inhalt übertragen** wählen, persönliche Accounts und Organisationen in einem gemeinsamen Feld suchen und den Wechsel nach einer Auswirkungsprüfung ausdrücklich bestätigen. Die Account-Suche läuft über den tenantgebundenen Keycloak-Provider und kann Namen oder E-Mail-Adressen als Suchschlüssel verwenden. Der Server übernimmt ausschließlich aktive, nicht technische und lokal derselben Instanz zugeordnete Accounts; E-Mail-Adressen werden nicht in der Trefferliste ausgegeben.

Ohne Suchtext lädt die Auswahl weiterhin eine lokale erste Account-Seite. Ein Keycloak-Ausfall verhindert deshalb nicht das Öffnen der Auswahl. Schlägt eine eingegebene Account-Suche fehl, wird der technische Fehler kenntlich gemacht und nicht als abschließend leere Treffermenge dargestellt. Erreicht eine sehr breite Suche die feste Scan-Grenze, bleiben bereits bestätigte Treffer sichtbar und die Auswahl fordert dazu auf, den Suchbegriff weiter einzugrenzen.

Die Ermittlung und Anzeige des aktuellen Inhabers ist von der Transferberechtigung getrennt. Der Autorisierungs-Endpunkt liefert deshalb auch ohne wirksames `content.transferOwnership` den frisch gelesenen Inhaberstatus mit `canTransfer: false`. Das gilt ebenso für im Editor sichtbare Typen wie Surveys, deren Transfervertrag noch nicht unterstützt wird; nur Zielsuche und Transfer bleiben dort deaktiviert.

Die Zielauswahl enthält nur aktive Principals derselben Instanz. Für Mainserver-Inhalte werden verwendbare Credentials verlangt. Ist deren aktuelle DataProvider-Bindung bereits eindeutig und konfliktfrei, ist das Ziel direkt bereit. Fehlt nur die gespeicherte Bindung, bleibt das Ziel auswählbar und wird mit dem Hinweis gekennzeichnet, dass die DataProvider-Zuordnung beim bestätigten Transfer sicher geprüft wird. DataProvider-IDs oder Credentials können nicht frei eingegeben werden.

Diese Prüfung erfolgt anlassbezogen: Erst nach ausdrücklicher Bestätigung lädt der Server für genau das ausgewählte Ziel `/data_provider.json`, speichert die authentifizierte Beobachtung konfliktbewusst und löst das Ziel erneut auf. Blättern und Suchen in der Zielauswahl erzeugen daher keine externen Identity-Aufrufe je Treffer. Liefert die Prüfung keine verwendbare Identität oder einen Konflikt, erfolgt kein Mainserver-Write.

Mainserver-Transfers sind derzeit durch die oben beschriebene Schutzsperre deaktiviert. Nicht unterstützte Typen bleiben zusätzlich durch die serverseitige Typmatrix ausgeschlossen.

Nach Erfolg wird zuerst eine Bestätigung angezeigt und der Inhaber aktualisiert. Geht durch den Transfer der Detailzugriff verloren, führt das Studio kontrolliert in die Inhaltsübersicht zurück.

## Unterstützte Typen

| Typ                                                      | Mainserver-Vertrag in `ee619d0e` | Anzeige im Studio | Transfer im Studio |
| -------------------------------------------------------- | -------------------------------- | ----------------- | ------------------ |
| News, Events, POI                                        | Bestätigt                        | Ja                | Vorübergehend gesperrt |
| Root-GenericItems, FAQ, Cockpit Cards, Featured Projects | Bestätigt                        | Ja                | Vorübergehend gesperrt |
| Touren                                                   | Bestätigt                        | Kein Editor       | Nein               |
| Surveys                                                  | Nicht bestätigt                  | Ja                | Nein               |
| Legacy SurveyPolls und Batch-Importe                     | Ausgeschlossen                   | Nein              | Nein               |

Der Mainserver-Vertrag führt bei den fünf bestätigten Root-Typen die jeweils abhängigen Datensätze und `ExternalReference` innerhalb derselben Transaktion auf den Ziel-DataProvider nach. Für Touren ist der Upstream-Vertrag vorhanden; das Studio besitzt derzeit jedoch keinen redaktionellen Tour-Editor und aktiviert deshalb keinen ungenutzten Transferpfad.

Der bisherige Vertragsnachweis aus Mainserver-Commit `ee619d0e` belegt Provider-Auswahl, die Übertragung abhängiger Datensätze und Rollback-Verhalten. Er belegt jedoch nicht den Erhalt ausgelassener verschachtelter Inhaltsdaten und reicht deshalb für eine Wiederfreigabe nicht aus. Die Studio-Regressionstests prüfen nun für alle vier SDK-Typen die Ablehnung vor jeglichem Konfigurations-, Credential- oder Upstream-Zugriff; die Routentests sichern weiterhin die getrennte Autorisierungs- und Abgleichlogik ab.

Die Konflikt-Changes `add-mainserver-user-conflict-reconciliation` und `auto-reconcile-deleted-user-data-provider-conflicts` pflegen Principal- und DataProvider-Bindungen. Sie übernehmen keine Content-Transfersemantik. Der Transfer konsumiert ausschließlich deren eindeutiges, aktuelles Binding-Ergebnis; eine noch fehlende Zielbindung darf er vor dem Write über denselben authentifizierten Beobachtungsvertrag erzeugen.

## Fehler und Abgleich

Nach einem vom Mainserver bestätigten Transfer übernimmt der Studio-Nachlauf den Ziel-Principal in `iam.contents` und dokumentiert den Inhaberwechsel in der Content-Historie, sofern die frisch gelesene Zeile dessen DataProvider-Bindung bestätigt. Organisationszuordnung, persönlicher Owner und Organisations-Owner werden zusammen korrigiert. Bei älteren Projekten mit zwei verschiedenen Core-Referenzen werden beide Einträge nachgeführt, bevor der Journalvorgang als abgeglichen gilt. Dies gilt auch, wenn der Core-Eintrag beim unmittelbaren Nachlauf erstmals gebunden oder ein zurückgestellter Abgleich wiederholt wird. Beim Wiederanlauf führt der Nachlauf nur den Inhaber nach und ordnet späteren Inhalt nicht rückwirkend dem Transfer zu. Ein späterer bestätigter Transfer desselben Provider-Datensatzes verhindert, dass ein verspäteter älterer Nachlauf den neueren Inhaber überschreibt; fehlt die Historie des älteren Vorgangs, bleibt er zur Prüfung offen. Solange ein späterer Transfer noch `pending` oder `unknown` ist, bleibt der ältere Nachlauf auch mit vorhandener Historie offen. Scheitert der spätere Transfer, kann die ältere Owner-Reparatur erneut versucht werden. Die persönliche Autorenanzeige bleibt erhalten, sofern ihr Modus für den neuen Inhaber zulässig ist; im Organisationsmodus gilt der Name der bestätigten Zielorganisation. Ist ein bisheriger Anzeigemodus nach dem Wechsel nicht mehr zulässig, gilt die frisch gelesene Autorenanzeige des Providers. Fehlt beim Wiederanlauf eine bestehende Core-Referenz, bleibt der Vorgang im Abgleich, damit der aktuelle Inhalt nicht als Teil des alten Transfers historisiert wird. Bei fehlender oder abweichender Inhaberbindung bleibt der Vorgang ebenfalls im Abgleich. Eine Wiederholung des Nachlaufs löst keinen zweiten Provider-Transfer aus.

Projektänderungen können über die Core-ID oder die Provider-ID adressiert werden. Eine ältere Projekt-Core-ID wird über ihre Provider-ID zuerst auf die kanonische `GenericItem`-Referenz aufgelöst; die Legacy-Referenz bleibt Rückfall, falls kein kanonischer Core vorhanden ist. Der Projekt-Route erstellt oder aktualisiert den gefundenen Core mit dem vollständigen Projektinhalt und belegt den erfolgreichen lokalen Schritt unter der Journal-Operations-ID, auch wenn die Create-Referenz einen anderen Idempotency-Key verwendet. Bei einem Lesefehler an einer vorhandenen Core-Referenz bleibt der Nachlauf offen. Der allgemeine Projektionsnachlauf überspringt diesen Core nur, wenn der Journalvorgang die vollständige lokale Aktualisierung bestätigt. Andernfalls bleibt der Vorgang im Abgleich, statt den vollständigen Inhalt mit einer verkürzten Listenprojektion zu überschreiben.

Fehlende Permission, ungültige Ziel-Principals, fehlende Ziel-Credentials, eine nicht erreichbare Zielidentität und widersprüchliche Zielbindungen werden vor dem Provider-Write abgelehnt. Der aktuelle Quell-DataProvider stammt aus einem frischen Read mit den Credentials des autorisierten Actors. Eine eindeutige Studio-Principal-Bindung des bisherigen Inhabers dient nur der Anzeige und dem Audit und ist mit Scope `all` keine Vorbedingung. Der kanonisch ebenfalls globale unscoped Legacy-Grant bleibt dabei zu `all` kompatibel. Der Transferpfad erzwingt die exakte Scope-Auswertung; Kompatibilitäts- und Shadow-Modi dürfen `own` oder `organization` weder bei fehlenden noch bei inaktiven Quell-Principals erweitern. Anzeige und Audit unterscheiden eine regulär fehlende Bindung (`unresolved`) von einem technischen Fehler der Anreicherung (`failed`), ohne die Transferaktion bei globaler Berechtigung zu sperren. Ist der Ausgang nach einem Timeout weder über Ziel- noch Actor-Credentials eindeutig feststellbar, meldet das Studio `reconciliation_required`; der Vorgang darf dann nicht als sicher fehlgeschlagen wiederholt werden.
