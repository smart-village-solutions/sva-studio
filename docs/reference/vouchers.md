# Gutscheine im Studio

Das optionale Modul `vouchers` verwaltet den Inhaltstyp `vouchers.voucher`. Es setzt das Ortsmodul voraus. Die Registrierung im Katalog aktiviert das Modul nicht automatisch für eine Instanz. Instanzzuweisung und Rollen bleiben Aufgaben der Administration.

## Redaktion

Die Übersicht bietet Suche, Orts-, Kategorie- und Sichtbarkeitsfilter. Der Ortsfilter lädt alle berechtigten Ergebnisseiten nach. Aus dem Ortseditor führt „Gutscheine dieses Ortes ansehen“ zur gefilterten Übersicht. Gutscheine werden im eigenen Bereich erstellt. Die Erstellung erfolgt auf einer Seite in dieser Reihenfolge: Überschrift, optionale Einleitung und Beschreibung, Bilder und Kategorien, Einlöseort, Vorteil, Kontingent, optionale Gültigkeit, Sichtbarkeit und Zusammenfassung.

Aktuell ist genau ein bestehender Ort zulässig. Ein bestehender Gutschein kann seinen Ort nicht wechseln. Die Domäne führt Ortszuordnungen bereits als Liste; mehrere Zuordnungen werden bis zur Unterstützung durch den Mainserver serverseitig abgelehnt. Das Kontingent gehört zum Gutschein. Eine spätere Mehrfachzuordnung soll dasselbe Kontingent verwenden.

Neue Gutscheine sind zunächst ausgeblendet. Prozentnachlass, fester Nachlass und reduzierter Preis sind alternative Rabattmodi; bei einem reduzierten Preis muss der ursprüngliche Preis angegeben werden. Der reduzierte Preis darf null sein, aber nicht über dem ursprünglichen Preis liegen. Gesamtkontingent und optionales Personenmaximum gelten im gewählten Kalenderzeitraum; „einmalig“ gilt für die Laufzeit des aktuellen Kontingents. Fehlende Gültigkeitsgrenzen bedeuten keine zusätzliche Datumsgrenze.

Bilder können über eine öffentliche HTTP(S)-Adresse oder aus der vorhandenen Studio-Medienbibliothek ausgewählt werden. Alternativtext, Bildunterschrift und Urheberangabe sind bearbeitbar. Bibliotheksauswahl und geänderte Medienreferenzen benötigen die bestehenden Medienrechte. Uploads und zentrale Medienbearbeitung erfolgen in der vorhandenen Medienverwaltung. Unbekannte bestehende Medienreferenzen werden nicht stillschweigend entfernt.

## Inhaltsänderung und Sichtbarkeit

Der aktuelle Mainserver speichert Gutscheine als verschachtelte Inhalte eines Ortes. Ein Ortsupdate erzeugt neue Gutschein- und Kontingentdatensätze und entfernt die bisherigen Einlösungen. Deshalb erfordern Erstellung bei vorhandenen Gutscheinen, Inhaltsbearbeitung und normale Ortsänderungen eine ausdrückliche Bestätigung für **alle** Gutscheine des Ortes, einschließlich ausgeblendeter Geschwister.

Die Bestätigung gilt für das konkrete Formular, den frisch gelesenen Gesamtbestand, Konto, Organisation und Credential-Kontext. Änderungen am Formular oder ein abweichender Bestand erfordern eine neue Vorbereitung. Ein unveränderter Gutschein wird nicht erneut gespeichert. Die separate Sichtbarkeitsaktion verwendet `changeVisibility` und erhält die Einlösungen. Löschen von Gutscheinen und Löschen beziehungsweise isolierte Ownership-Übertragung eines Ortes mit Gutscheinen werden abgelehnt. Allgemeine GenericItem-Schreib- und Löschwege können diese Regeln auch bei deaktiviertem Modul nicht umgehen. Direkte Core-Erstellung, -Bearbeitung, -Archivierung, -Löschung und -Ownership-Übertragung sind für den Gutschein-Inhaltstyp ebenfalls gesperrt.

Die Regeln gelten für Studio-Schreibwege. Externe CMS-, App- oder Mainserver-Schreibzugriffe werden dadurch nicht gesperrt. Zwischen letztem Read und externer Mutation bleibt ein nicht atomarer Konkurrenzzeitraum; ohne Mainserver-Änderung gibt es keinen Compare-and-swap-Vertrag.

## Nutzungszahlen

Die Anzeige berechnet registrierte Einlösungen aus `maxQuantity - availableQuantity`. Sie zeigt Maximum, Rest, Auslastung, Zeitraum und Zeitpunkt des letzten erfolgreichen Abrufs. Die Aktualisierung ist ein Read und speichert keine Formularänderungen. Ungespeicherte Eingaben ändern die Nutzungsanzeige nicht. Fehlende oder widersprüchliche Werte erscheinen als unbekannt beziehungsweise inkonsistent; Überziehung bleibt mit negativen Restwerten und mehr als 100 Prozent sichtbar.

Gezählt werden gespeicherte Einlösungen im aktuellen Kontingent und Zeitraum, keine eindeutigen Personen. Eine Mengen-Einlösung von drei erzeugt im bestehenden Mainserver drei Einlösungsdatensätze. Noch nicht synchronisierte Offline-Einlösungen fehlen. Der Abrufzeitpunkt ist kein Zeitpunkt der letzten Einlösung. Es gibt keine Lebenszeit-, Personen-, Umsatz- oder Trendstatistik. Eine bestätigte Inhaltsänderung setzt den Bestand der Einlösungen zurück.

## Datenintegrität und Vertragsgrenzen

Die vollständige schreibbare Feldinventur und die GraphQL-Dokumente liegen in `packages/sva-mainserver/src/generated/vouchers.ts`; Vertragstests prüfen sie gegen den eingecheckten Schema-Snapshot. Der Detail-Read liefert einen Inhaltsfingerprint, den Edit-Vorbereitung und Commit als `baseFingerprint` zurücksenden. So werden inzwischen geänderte Inhalte bereits beim Vorbereiten erkannt; reine Änderungen der verfügbaren Menge verändern diese Editorversion nicht. Vor jedem destruktiven Write wird der Gesamtbestand neu gelesen. Beliebige bestehende Schlüssel in Objekt-Payloads, zusätzliche Inhaltsblöcke, Datumsmetadaten und unveränderte Medienmetadaten werden erhalten. Auch ohne Datumsgrenzen bleiben Wochentags- und Uhrzeitregeln bei einer Inhaltskorrektur bestehen. Der Readback prüft alle geschriebenen und erhaltenen Felder. Schreibende GraphQL-Aufrufe haben keinen automatischen Retry.

Aktuell ist ein Write nur nachweislich sicher, wenn der Datenanbieter vom Typ `business_account` ist. Nur die vorhandene Mainserver-Ausnahme für diesen Typ schützt Ankündigungen, die öffentliche Reads ausblenden können. Weil auch inverse Kategoriezuordnungen aktive Kategorien filtern, wird ein Write bei inaktiven Kategorien im gelesenen Kategoriebestand konservativ abgelehnt. Fremde Anbieter, zusätzliche nicht sicher rekonstruierbare Gutscheinbeziehungen, doppelte Identitäten, unvollständige Reads und nicht als Objekt rekonstruierbare Payloads werden ebenfalls abgelehnt. Diese Einschränkungen sind echte Grenzen des aktuellen Providers, keine Zusage vollständiger CMS-Kompatibilität.

Eine Gutscheinidentität in `payload.id` bleibt bestehen. Fehlende Identitäten werden vor der Mutation vergeben und dem vorbereiteten Versuch zugeordnet. Nach dem Write werden die neuen Mainserver-IDs über diese Identitäten aufgelöst. Vorhandene Core-Referenzen werden neu gebunden; dadurch bleibt ihre Studio-Historie erhalten. Medienreferenzen werden im vorhandenen Instanz-Transaktionspfad übertragen. Betroffene Gutscheinprojektionen und der Ort werden aktualisiert. Die Historie erfasst ausschließlich Studio-Änderungen und keine Einlösungen.

Bei unklarem Ausgang bleibt der vorbereitete Versuch als opaker Schlüssel im Tab erhalten. „Abgleichen“ liest den Ort neu und verlangt die passende Operationsmarkierung im Orts-Payload sowie eindeutige Gutscheinidentitäten. Der Kontext muss mit dem vorbereiteten Versuch übereinstimmen. Zusätzlich wird der vollständige POI einschließlich aller Gutscheine gegen den serverseitig im bestehenden Idempotenzdatensatz hinterlegten Sollzustand geprüft. Nur die beim Write frisch vergebenen technischen Payload-Felder `studioUpdatedAt` und `studioUpdateId` sind von diesem Recovery-Vergleich ausgenommen. Fehlende oder abweichende Inhalte bleiben ungeklärt. Auch nach Reload ist kein erneuter Provider-Write erforderlich; eine gelöschte alte Datenbank-ID wird nicht als Beweis für einen fehlgeschlagenen Save verwendet. Die bestehenden Idempotenzdaten werden nach 24 Stunden bereinigt. Danach oder bei einer später überschriebenen Operationsmarkierung bleibt der Ausgang bewusst ungeklärt; es erfolgt keine automatische Neuerstellung.

Sicher vor dem Write abgelehnte Versuche, etwa wegen eines nicht mehr verfügbaren Bildes oder eines unvollständigen Ortsbestands, entsperren den Editor zur Korrektur. Für tatsächlich unklare Schreibausgänge bleibt die Sperre samt Abgleich auch nach Reload bestehen.

## Technische Einstiege und Abnahme

Die API liegt unter `/api/v1/mainserver/vouchers`: Übersicht und numerische Detail-IDs sind GETs, `locations` liefert berechtigte Ortsoptionen, `prepare` bereitet einen Save vor, `commit` schreibt einmalig, `reconcile` gleicht einen unklaren Versuch ab und `/:id/visibility` ändert die Sichtbarkeit separat. Alle Mutationen prüfen CSRF und die bestehenden Principal-Verträge. Commit und Abgleich verwenden die Vorbereitungs-ID zusätzlich als `X-SVA-Operation-Id`, damit Idempotenz, Journal und Historie denselben Versuch referenzieren. Die Vorbereitung normaler Ortsupdates nutzt den vorhandenen POI-Endpunkt mit `X-SVA-Voucher-Reset-Mode: prepare`; der bestätigte Save sendet die gebundene Vorbereitungs-ID und den Fingerprint.

Lokale Unit-, UI- und Vertragstests ersetzen keine Abnahme gegen eine konkrete Mainserver-/App-Instanz. Die kontrollierte Erstellung, Einlösung und anschließende Inhaltsbearbeitung mit isolierten Testdaten sowie die beobachtete redaktionelle UX-Abnahme bleiben eigene Schritte des [OpenSpec-Changes](../../openspec/changes/add-vouchers-plugin/tasks.md). Es wurde keine Produktionsinstanz schreibend getestet und kein Rollout ausgelöst.

Backend-Follow-up: [Mainserver #445](https://github.com/smart-village-solutions/smart-village-app-mainserver/issues/445), [SVA-1778](https://tpwd.atlassian.net/browse/SVA-1778).
