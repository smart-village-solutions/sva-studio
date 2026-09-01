# Inhaber von Inhalten übertragen

## Fachlicher Vertrag

Der aktuelle Inhaber eines Mainserver-Datensatzes ist dessen aktuell gelesener DataProvider. Audit und Historie können Transfers erläutern, sind wegen möglicher externer Änderungen aber nie die Quelle für die aktuelle Anzeige. Bei lokalen Studio-Inhalten ist genau ein persönlicher Account oder eine Organisation als Owner gespeichert.

Normales Bearbeiten und Speichern ändert den Inhaber nicht. Auch ein abweichender Mutationsprincipal („Bearbeiten als“) ist keine Übertragung.

Die wirksame Permission `content.transferOwnership` ist die einzige fachliche Freigabe für eine Übertragung. Mit Scope `all` darf der Actor jeden für ihn sichtbaren und vom Typvertrag unterstützten Inhalt übertragen. Der bisherige Inhaber muss dafür weder aktiv noch im Studio eindeutig an einen Principal gebunden sein und benötigt keine verwendbaren Credentials. Bei `own` oder `organization` bleibt eine eindeutige Bindung erforderlich, soweit sie den jeweiligen Source-Scope nachweist.

## Bedienung

Im Bearbeitungsmodus steht der Bereich **Inhaber** am Anfang des ersten fachlichen Tabs. Er zeigt den aktuellen Inhaber und den dauerhaften Save-Hinweis. Nutzer mit wirksamem `content.transferOwnership` können **Inhalt übertragen** wählen, persönliche Accounts seitenweise auswählen, Organisationen suchen und den Wechsel nach einer Auswirkungsprüfung ausdrücklich bestätigen. Eine neue Suche über verschlüsselte Account-Namen oder E-Mail-Adressen ist nicht Bestandteil von V1.

Die Zielauswahl enthält nur aktive Principals derselben Instanz. Für Mainserver-Inhalte werden verwendbare Credentials verlangt. Ist deren aktuelle DataProvider-Bindung bereits eindeutig und konfliktfrei, ist das Ziel direkt bereit. Fehlt nur die gespeicherte Bindung, bleibt das Ziel auswählbar und wird mit dem Hinweis gekennzeichnet, dass die DataProvider-Zuordnung beim bestätigten Transfer sicher geprüft wird. DataProvider-IDs oder Credentials können nicht frei eingegeben werden.

Diese Prüfung erfolgt anlassbezogen: Erst nach ausdrücklicher Bestätigung lädt der Server für genau das ausgewählte Ziel `/data_provider.json`, speichert die authentifizierte Beobachtung konfliktbewusst und löst das Ziel erneut auf. Blättern und Suchen in der Zielauswahl erzeugen daher keine externen Identity-Aufrufe je Treffer. Liefert die Prüfung keine verwendbare Identität oder einen Konflikt, erfolgt kein Mainserver-Write.

Mainserver-Transfers für die bestätigten Studio-Typen sind dauerhaft im Code aktiviert. Sie benötigen keinen betrieblichen Konfigurationsschalter. Nicht unterstützte Typen bleiben durch die serverseitige Typmatrix ausgeschlossen.

Nach Erfolg wird zuerst eine Bestätigung angezeigt und der Inhaber aktualisiert. Geht durch den Transfer der Detailzugriff verloren, führt das Studio kontrolliert in die Inhaltsübersicht zurück.

## Unterstützte Typen

| Typ                                                      | Mainserver-Vertrag in `ee619d0e` | Anzeige im Studio | Transfer im Studio |
| -------------------------------------------------------- | -------------------------------- | ----------------- | ------------------ |
| News, Events, POI                                        | Bestätigt                        | Ja                | Ja                 |
| Root-GenericItems, FAQ, Cockpit Cards, Featured Projects | Bestätigt                        | Ja                | Ja                 |
| Touren                                                   | Bestätigt                        | Kein Editor       | Nein               |
| Surveys                                                  | Nicht bestätigt                  | Ja                | Nein               |
| Legacy SurveyPolls und Batch-Importe                     | Ausgeschlossen                   | Nein              | Nein               |

Der Mainserver-Vertrag führt bei den fünf bestätigten Root-Typen die jeweils abhängigen Datensätze und `ExternalReference` innerhalb derselben Transaktion auf den Ziel-DataProvider nach. Für Touren ist der Upstream-Vertrag vorhanden; das Studio besitzt derzeit jedoch keinen redaktionellen Tour-Editor und aktiviert deshalb keinen ungenutzten Transferpfad.

Der Vertragsnachweis liegt in Mainserver-Commit `ee619d0e`: Die Mutation-Specs prüfen die explizite Provider-Auswahl einschließlich TourStops, die `ResourceService`-Specs die Übertragung abhängiger GenericItems sowie den vollständigen Rollback von Root, Kind und `ExternalReference`. Die Studio-Adaptertests ergänzen Fresh Read, bestätigten Ziel-Provider, verlorenen Response, Retry-/Konfliktpfade und `reconciliation_required`.

Die Konflikt-Changes `add-mainserver-user-conflict-reconciliation` und `auto-reconcile-deleted-user-data-provider-conflicts` pflegen Principal- und DataProvider-Bindungen. Sie übernehmen keine Content-Transfersemantik. Der Transfer konsumiert ausschließlich deren eindeutiges, aktuelles Binding-Ergebnis; eine noch fehlende Zielbindung darf er vor dem Write über denselben authentifizierten Beobachtungsvertrag erzeugen.

## Fehler und Abgleich

Fehlende Permission, ungültige Ziel-Principals, fehlende Ziel-Credentials, eine nicht erreichbare Zielidentität und widersprüchliche Zielbindungen werden vor dem Provider-Write abgelehnt. Der aktuelle Quell-DataProvider stammt aus einem frischen Read mit den Credentials des autorisierten Actors. Eine eindeutige Studio-Principal-Bindung des bisherigen Inhabers dient nur der Anzeige und dem Audit und ist mit Scope `all` keine Vorbedingung. Ist der Ausgang nach einem Timeout weder über Ziel- noch Actor-Credentials eindeutig feststellbar, meldet das Studio `reconciliation_required`; der Vorgang darf dann nicht als sicher fehlgeschlagen wiederholt werden.
