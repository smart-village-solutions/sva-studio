# Inhaber von Inhalten übertragen

## Fachlicher Vertrag

Der aktuelle Inhaber eines Mainserver-Datensatzes ist dessen aktuell gelesener DataProvider. Audit und Historie können Transfers erläutern, sind wegen möglicher externer Änderungen aber nie die Quelle für die aktuelle Anzeige. Bei lokalen Studio-Inhalten ist genau ein persönlicher Account oder eine Organisation als Owner gespeichert.

Normales Bearbeiten und Speichern ändert den Inhaber nicht. Auch ein abweichender Mutationsprincipal („Bearbeiten als“) ist keine Übertragung.

## Bedienung

Im Bearbeitungsmodus steht der Bereich **Inhaber** am Anfang des ersten fachlichen Tabs. Er zeigt den aktuellen Inhaber und den dauerhaften Save-Hinweis. Nutzer mit wirksamem `content.transferOwnership` können **Inhalt übertragen** wählen, getrennt nach persönlichem Account und Organisation suchen und den Wechsel nach einer Auswirkungsprüfung ausdrücklich bestätigen.

Die Zielauswahl enthält nur aktive Principals derselben Instanz. Für Mainserver-Inhalte werden zusätzlich eindeutige aktuelle DataProvider-Bindungen und verwendbare Credentials verlangt. DataProvider-IDs oder Credentials können nicht frei eingegeben werden.

Nach Erfolg wird zuerst eine Bestätigung angezeigt und der Inhaber aktualisiert. Geht durch den Transfer der Detailzugriff verloren, führt das Studio kontrolliert in die Inhaltsübersicht zurück.

## Unterstützte Typen

| Typ                                                 | Mainserver-Vertrag in `ee619d0e` | Anzeige im Studio | Transfer im Studio |
| --------------------------------------------------- | ---------------------------------- | ----------------- | ------------------ |
| News, Events, POI                                   | Bestätigt                          | Ja                | Ja                 |
| Root-GenericItems, FAQ, Cockpit Cards, Featured Projects | Bestätigt                     | Ja                | Ja                 |
| Touren                                              | Bestätigt                          | Kein Editor       | Nein               |
| Surveys                                             | Nicht bestätigt                    | Ja                | Nein               |
| Legacy SurveyPolls und Batch-Importe                | Ausgeschlossen                     | Nein              | Nein               |

Der Mainserver-Vertrag führt bei den fünf bestätigten Root-Typen die jeweils abhängigen Datensätze und `ExternalReference` innerhalb derselben Transaktion auf den Ziel-DataProvider nach. Für Touren ist der Upstream-Vertrag vorhanden; das Studio besitzt derzeit jedoch keinen redaktionellen Tour-Editor und aktiviert deshalb keinen ungenutzten Transferpfad.

Der Vertragsnachweis liegt in Mainserver-Commit `ee619d0e`: Die Mutation-Specs prüfen die explizite Provider-Auswahl einschließlich TourStops, die `ResourceService`-Specs die Übertragung abhängiger GenericItems sowie den vollständigen Rollback von Root, Kind und `ExternalReference`. Die Studio-Adaptertests ergänzen Fresh Read, bestätigten Ziel-Provider, verlorenen Response, Retry-/Konfliktpfade und `reconciliation_required`.

Die Konflikt-Changes `add-mainserver-user-conflict-reconciliation` und `auto-reconcile-deleted-user-data-provider-conflicts` pflegen Principal- und DataProvider-Bindungen. Sie übernehmen keine Content-Transfersemantik. Der Transfer konsumiert ausschließlich deren eindeutiges, aktuelles Binding-Ergebnis.

## Fehler und Abgleich

Fehlende Permission, ungültige Ziel-Principals, fehlende Credentials und widersprüchliche Bindungen werden vor dem Provider-Write abgelehnt. Ist der Ausgang nach einem Timeout weder über Ziel- noch Quell-Credentials eindeutig feststellbar, meldet das Studio `reconciliation_required`; der Vorgang darf dann nicht als sicher fehlgeschlagen wiederholt werden.
