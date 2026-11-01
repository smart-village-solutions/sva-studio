# Baustellen im Studio

Das optionale Plugin `construction-sites` erstellt und bearbeitet bestehende Mainserver-`GenericItem`-Datensätze mit dem exakten Typ `ConstructionSite`. Sein Studio-Inhaltstyp lautet `construction-sites.construction-site`. Es benötigt keine Datenmigration und verändert weder Mainserver noch App. Der bestehende Distributionskatalog führt es in Studio; SSF und eine benutzerdefinierte Auswahl ohne Baustellen schließen das optionale Package aus. Der Serveradapter besitzt seinen eigenen Eingangsvertrag; gemeinsame Fixtures sichern dessen Kompatibilität zur Clientvalidierung.

## Redaktionelle Bedienung

Die Übersicht unter `/admin/content?type=construction-sites.construction-site` zeigt Titel, ersten Standort, Beginn, Ende, Zeitraumstatus und letzte Änderung. Titelsuche, Kategorie und sich überschneidender Zeitraum werden vor der Seiteneinteilung auf alle lesbaren Baustellen angewendet. Ein leerer Filtertreffer ist kein Ladefehler. Die Übersicht verwendet die vom Studio vorgegebene Identität und wartet auf einen verfügbaren Organisationskontext.

Beim Anlegen stehen die Eingaben auf einer Seite. Beim Bearbeiten sind sie in „Basis“, „Inhalt“ und „Historie“ gegliedert. Titel sowie Beginn und Ende des ersten Zeitraums sind erforderlich. Ein ausdrücklich gewähltes Ende bleibt bei Änderungen am Beginn erhalten. Fehlende Bestandsdaten werden nicht durch heutige Daten ersetzt.

Richtung, Grund, Einschränkungen, Beschreibung, Standort, Kategorien und Dateien sind optional. Koordinaten werden paarweise angegeben; `0` ist ein gültiger Wert. Die Karte nutzt die konfigurierte Studio-Schnittstelle und bleibt optional. Ohne Kartenverbindung ist die Eingabe der Koordinaten möglich. Die vorhandene Mediathek bietet Bild-Uploads; andere unterstützte Dateiarten können aus der Mediathek oder über eine dauerhafte URL zugeordnet werden. Vorläufige Uploads dürfen noch nicht als dauerhafte Dateien zugeordnet werden; diese Prüfung gilt auch bei der Wiederaufnahme eines Speichervorgangs.

Die geprüfte App verwendet jeweils den ersten Zeitraum, Standort, Textblock, die erste Kategorie und Datei sowie alle Einschränkungen. Weitere vorhandene Einträge bleiben zugänglich. Die Dateireihenfolge lässt sich ändern. Die tatsächliche Darstellung weiterer Dateiarten hängt von der Ziel-App ab.

Neue Baustellen sind zunächst unsichtbar. Zeitraumstatus und Sichtbarkeit sind unabhängig: Ein zukünftiger Beginn plant keine Veröffentlichung. Sichtbarkeitsänderungen benötigen zusätzlich das passende Host-Recht. Die Historie zeigt ausschließlich im Studio erfasste Änderungen.

## Rechte und Aktivierung

Das Modul muss der Instanz zugewiesen sein. Es trägt ausschließlich `construction-sites.read`, `construction-sites.create` und `construction-sites.update` bei. Es gibt keine Löschaktion. Der bestehende Host prüft Account, Organisation, Principal, DataProvider und Objektzugriff. Das Plugin verwendet keine Berechtigungen eines anderen Fachplugins. Das ausgewählte „Erstellen als“ beziehungsweise „Handeln als“ bestimmt die verwendete Identität.

Die gemeinsame Inhaltsübersicht ordnet `ConstructionSite` diesem Plugin zu; andere GenericItem-Typen bleiben beim bestehenden zuständigen Plugin. Die technische GenericItem-Ansicht bleibt unabhängig davon bestehen.

## Schreibvertrag und Grenzen

Vor einem Update liest der Adapter sämtliche verfügbaren schreibbaren Felder und Metadaten frisch. Ein Fingerprint des vollständigen Lesestands verhindert das Überschreiben zwischenzeitlich erkannter Änderungen. Unveränderte Texte sowie unbekannte Payload- und Relationsmetadaten bleiben erhalten. Verändertes HTML wird durch die bestehende Rich-Text-Policy bereinigt. Nicht wiederherstellbare zusätzliche Beziehungen oder beschädigte Strukturen werden vor dem Write abgewiesen; der Eintrag bleibt, soweit seine Identität sicher lesbar ist, lesbar.

**Fachlich freigegebene Ausnahme:** Die Mainserver-Leseschnittstelle liefert nur aktive Kategoriezuordnungen. Zuordnungen zu deaktivierten Kategorien dürfen daher beim Speichern entfallen. Das ist keine Freigabe für den Verlust anderer Felder oder Beziehungen. Neu gewählte Kategorien werden serverseitig gegen aktive kompatible Kategorien geprüft.

Der Mainserver ersetzt Relationen beim Speichern. Der Adapter sendet deshalb einen aus dem autoritativen Snapshot aufgebauten vollständigen Write und prüft das Ergebnis unabhängig nach. Der Host-Lock serialisiert Studio-Updates derselben GenericItem-ID. Da Mainserver keine atomare Revisionsvorbedingung anbietet, bleibt ein Konkurrenzfenster zu Schreibzugriffen anderer Systeme bestehen; eine konfliktfreie Zusammenführung wird nicht zugesichert.

Eindeutige Ablehnungen vor der Speicherung lassen die Eingaben zur Korrektur frei. Bei einem bereits unklaren Ergebnis bleibt die Wiederaufnahme auch nach einer Ablehnung gegen erneutes Schreiben gesperrt. Jeder Save erhält eine stabile Operations-ID. Die bestehende Idempotenzablage hält die erwartete Änderung an Identität, Organisation und Credential-Kontext gebunden fest. Im Browser werden nur Operations-ID, Request-Hash und gegebenenfalls Bestands-ID gespeichert. Bei unklarem Ergebnis wird derselbe Vorgang mit „Speicherergebnis prüfen“ gelesen und nachverarbeitet; ein Provider-Write wird dabei nicht wiederholt. Eine neue Anlage wird über ihre operationsgebundene `externalId` gefunden. Ein bereits gespeicherter Inhalt mit unvollständiger lokaler Nachverarbeitung wird separat gemeldet und bleibt gegen erneutes Speichern gesperrt.

Die Listenabfrage verwendet den bestehenden begrenzten Upstream-Scan. Erreicht sie dessen Grenze, meldet sie einen Fehler statt unvollständige Ergebnisse als vollständige Liste auszugeben.

## Nachweise und Abnahme

Lokale Tests prüfen den realen GraphQL-Variablenvertrag gegen den vorhandenen Schema-Snapshot, eine ersetzende Mainserver-Mutation mit Readback, Bestandserhalt, Rechte, CSRF, Konflikte, verlorene Antworten, Wiederaufnahme nach Reload und die Formularbedienung. Diese Fixtures ersetzen keine Abnahme gegen einen bestimmten produktiven Mainserver- und App-Versionsstand.

Live-Schreibtests und Rollout benötigen einen gesondert benannten Zielkontext und isolierte Testdaten. Maßgeblich für die technische Bereitstellung ist ausschließlich der [Studio-Rollout-Prozess](../guides/studio-rollout-process.md).
