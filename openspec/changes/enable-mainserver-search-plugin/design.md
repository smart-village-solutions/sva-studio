## Kontext und belegte Ausgangslage

- `packages/plugin-search/src/plugin.ts` enthält keine Routen; `header-preview.tsx` bewahrt das frühere deaktivierte Suchfeld. Der Studio-Katalog führt `search` als `enabled: false`, `availability: in-development`.
- Die untersuchte Meilisearch-Instanz läuft mit Version 1.9.0. Die Mainserver-Kernindizes sind nach Modell und Rails-Umgebung getrennt; Gemeinde und Datenanbieter sind Dokumentfelder.
- Die fünf geprüften Mainserver-Modelle NewsItem, EventRecord, PointOfInterest, GenericItem und Tour indexieren nur sichtbare Datensätze mit Gemeindezuordnung. Deren Indexierung bleibt in diesem Abschnitt unverändert.
- Die Mainserver-Listensuche schneidet Meilisearch-Treffer mit einem benutzerbezogenen Datenbank-Scope. Die übergreifende Mainserver-Suche enthält im geprüften Pfad dagegen Gemeinde-/Kategoriefilter ohne denselben benutzerbezogenen Abgleich und ist keine ausreichende Studio-Autorisierung.
- Studio hat bereits effektive Permissions, aktive Organisationskontexte, verifizierte DataProvider-Bindungen, Mainserver-Lesezugriffe und berechtigte Listenprojektionen. Die bisherige Suche in der Inhaltsübersicht verwendet SQL; sie wird nicht ersetzt.

## Entscheidungen

### Bestehendes Plugin und Host-Wiring erweitern

Das vorhandene Paket `plugin-search` ist Eigentümer von Such-UI, Suchzustand, Übersetzungen und Suchablauf. Der Host materialisiert `/plugins/search` und den serverseitigen Plugin-Suchhandler über die vorhandenen Verträge. `search.read` erlaubt die Benutzung der Suche, ersetzt aber keine typspezifischen oder datensatzbezogenen Leserechte.

Der Header erhält die kleinste konkrete Anbindung an das aktivierte Suchplugin. Es entsteht keine allgemeine Header-Extension-Plattform. Descriptor und Browser-Entry bleiben entsprechend den vorhandenen Plugin-Konventionen getrennt; serverseitige Geheimnisse und Runtime-Implementierungen gelangen nicht in den Browser-Snapshot. Der Entwicklungsstatus wird erst nach Lieferung und Prüfung des vollständigen Pfads aufgehoben. Die bestehende Platzhalterdarstellung wird dabei ersetzt, nicht zusätzlich betrieben.

### Suchumfang und Ressourcenidentität

Gesucht wird ausschließlich im serverseitig festgelegten Mainserver-/Gemeinde- und Umgebungskontext. Eine im Browser übergebene Gemeinde-, Index-, Provider- oder Organisationskennung begründet keine Berechtigung. Freigeschaltete globale Quellen werden nur gemäß dem bestehenden Mainserver-Lesevertrag berücksichtigt.

Die fünf Kernindexfamilien bilden den untersuchten Datenbestand. Für die erste UI werden nur Inhaltstypen freigegeben, die eindeutig auf einen bestehenden Studio-Inhaltstyp, dessen Lesevertrag und eine Detailroute abgebildet werden können. Insbesondere wird `GenericItem` anhand der vorhandenen GenericType-Registry fachlich klassifiziert, bevor dessen Leserecht ausgewertet wird. Fehlt dieser Diskriminator im Suchindex, wird er über den bestehenden autorisierten Mainserver-Lesepfad oder eine hinreichend aktuelle, eindeutig gebundene Projektion aufgelöst. Eine unklare Zuordnung wird nicht zu einem generischen Vollzugriff umgedeutet. Neue Fachdetailseiten und der eigenständige `external_data`-Vertrag gehören nicht zum ersten Abschnitt.

Eine Kandidatenidentität besteht aus Mainserver-Verbindung, Umgebung, Quellmodell und Quell-ID. Gleiche numerische IDs unterschiedlicher Modelle dürfen sich nicht gegenseitig ersetzen. Die Zuordnung zu Studio-Typ und URL erfolgt ausschließlich serverseitig anhand registrierter Verträge.

### Zweistufige Prüfung ohne zweites Berechtigungsmodell

1. Sitzung, Instanz, Pluginaktivierung, `search.read`, aktive Organisation und effektive Permissions werden serverseitig ermittelt.
2. Die Meilisearch-Abfrage erhält den Suchbegriff und die zulässige Quellgrenze. Die fachlichen Filter werden nach dem Ressourcenabgleich angewendet, damit der aus erlaubten Treffern erzeugte Optionskatalog auch weitere Mehrfachauswahlen ermöglicht. Um Berechtigungsablehnungen zählen zu können, dürfen individuelle Leserechte den Kandidatenbestand nicht bereits stillschweigend verkleinern. Andere Mandanten und nicht freigegebene Quellen liegen dagegen immer außerhalb des Zählumfangs.
3. Suchkandidaten werden in Batches anhand bestehender Mainserver-/Studio-Leseregeln geprüft. Modul-/Typzugang und Ressourcen-Scope werden gemeinsam berücksichtigt. Projektionseintrag, DataProvider-Gleichheit oder Organisationsmitgliedschaft allein sind kein Zugriffsnachweis. Bereits vorhandene Kompatibilitätsregeln werden weder verschärft noch erweitert.
4. Nur freigegebene Treffer erhalten Titel, sicheren Textauszug, Inhaltstyp, Datenanbieter und Link in der Browserantwort. Eine erneute Detailabfrage prüft den aktuellen Zugriff weiterhin selbst.

Es gilt die aktive Organisation, keine Vereinigung aller Mitgliedschaften. Ein Wechsel von Instanz, Organisation, Identität, Mainserver-Credential-Fingerprint oder wirksamem Zugriff verwirft alte Suchantworten und Zählstände. Fehlende belastbare Zuordnungen werden nachgeladen oder als ungeklärt behandelt; bei Ausfall der Autorisierung wird kein Kandidat freigegeben. Lese- und Bearbeitungsrechte bleiben getrennt.

### Trefferzahlen und Grenzen

Für denselben Suchbegriff, fachlichen Filtersatz und Quellkontext werden Kandidaten dedupliziert und in drei Gruppen unterschieden: erlaubt, wegen Berechtigung abgelehnt und noch ungeklärt. Nur eine tatsächliche Autorisierungsablehnung erhöht die zweite Zahl. Gelöschte, veraltete oder technisch nicht auflösbare Datensätze sind keine Berechtigungsablehnung.

„20 Ergebnisse (+ 30 ohne passende Berechtigung)“ wird erst nach vollständiger Kandidatenerfassung und abgeschlossener Prüfung ohne ungeklärte Kandidaten angezeigt. Die Offenlegung der aggregierten Anzahl ausgeschlossener Treffer ist fachlich ausdrücklich gewollt; einzelne Angaben dieser Treffer bleiben verborgen.

Eine einzelne Meilisearch-Seite oder eine geschätzte Trefferzahl reicht nicht aus. Die untersuchten Kernindizes haben `maxTotalHits: 100000`. Bei Erreichen eines Ergebnislimits, unvollständigen Upstream-Antworten, Zeitlimits oder ungeklärten Kandidaten wird die Gesamtzahl nicht als exakt ausgegeben. Die UI kennzeichnet dann „Trefferzahl noch nicht vollständig ermittelt“ und bietet bei einem beendeten Fehlerzustand eine Wiederholung. Nur während tatsächlich laufender Arbeit erscheint ein Ladehinweis. Diese Grenze wird nicht durch Änderungen an Indexeinstellungen oder eine neue Job-Infrastruktur umgangen.

Die Zahlen beziehen sich auf den vollständig geprüften Abfragestand, nicht auf eine garantierte transaktionale Momentaufnahme über Meilisearch, Mainserver und IAM hinweg. Ein neuer Suchlauf ermittelt einen neuen Stand. Die Umsetzbarkeit vollständiger Zählung innerhalb des vorhandenen Request-Budgets wird vor breiter Auslieferung mit repräsentativen Suchmengen gemessen; eine unzutreffende exakte Zahl ist kein zulässiger Fallback.

### Ergebnisreihenfolge und Paging

Der Server lädt Kandidaten über weitere Upstream-Seiten nach, bis eine erlaubte Ergebnisseite gefüllt oder der Kandidatenbestand erschöpft ist. Er dedupliziert vor dem Paging und erhält innerhalb eines Index die Suchreihenfolge. Für mehrere Indexfamilien wird eine deterministische Zusammenführung mit stabiler Identität als Tie-Breaker verwendet; rohe Ranking-Scores verschiedener Indizes gelten nicht automatisch als vergleichbar. Es wird keine globale Relevanzkalibrierung versprochen.

Der Berechtigungsfilter wird vor dem Paging der sichtbaren Treffer angewendet. Eine Seite mit ausschließlich ausgeschlossenen Kandidaten darf den Suchlauf nicht vorzeitig als beendet markieren. Die Ermittlung exakter Zahlen umfasst auch Kandidaten jenseits der sichtbaren Seite.

### Oberfläche

- Desktop: beschriftetes Suchformular in der Kopfzeile, Submit per Enter oder Suchbutton; keine Anfrage nur durch jeden Tastendruck.
- Mobil: Dasselbe Header-Suchfeld bleibt in einer eigenen Zeile sichtbar. Organisation, Navigation und bestehende Header-Aktionen bleiben erreichbar.
- Ergebnisseite: Keine weitere Sucheingabe; Zählstatus und vorhandene StudioDataTable mit Titel samt Textauszug, Inhaltstyp, Datenanbieter und Kategorien. Titel verlinken vorhandene Detailseiten.
- Filter: Inhaltstyp und Kategorie als Mehrfachauswahl, Datenanbieter als Auswahl; kombinierbar, mit entfernbaren Markierungen und „Filter zurücksetzen“. Es gibt zunächst keine weiteren Sortier- oder Datumsfilter.
- Filteroptionen und etwaige Optionszahlen stammen ausschließlich aus dem lesbaren Bestand im zulässigen Kontext; rohe Meilisearch-Facetten ausgeschlossener Inhalte werden nicht ausgegeben. Freie oder manipulierte Filterwerte erweitern niemals den Zugriff.
- `q`, Typen, Kategorien, Datenanbieter, Sortierung und sichtbare Ergebnisseite werden hostvalidiert und typisiert in der URL abgebildet. Browser-Zurück stellt den Suchzustand wieder her; Filteränderungen setzen das Paging zurück. Organisationskontext bleibt sitzungsgeführt.
- Leerer Suchbegriff startet keinen Vollbestandsscan. Keine Treffer, laufende Abfrage, unvollständige Prüfung und technische Fehler erhalten unterscheidbare Zustände. Ergebnisse einer überholten Anfrage überschreiben keine neuere Suche.
- Vorhandene Design-System-Komponenten und semantische Tokens; deutsche und englische Übersetzungen, Tastaturbedienbarkeit, sichtbarer Fokus, Status-Live-Region und WCAG 2.1 AA. Meilisearch-Highlight-HTML wird nicht ungeprüft in die Seite übernommen.

### Betrieb und Geheimnisse

Der Browser spricht ausschließlich mit Studio. Für die Anwendung ist ein eigener Suchschlüssel mit minimalen Aktionen und festgelegten Indexbereichen vorgesehen; der lokale Master Key bleibt der Diagnose vorbehalten. URL, Indexumgebung und geschützte Schlüsselzuführung werden serverseitig mit dem tatsächlichen Studio-/Mainserver-Ziel abgeglichen. Die lokale `.env.local` wird weder kopiert noch in Dokumentation, Tests oder Build-Artefakte übernommen.

Dieser Change autorisiert keine Schlüsselerstellung, Indexänderung, Aktivierung eines produktiven Mandanten oder Auslieferung. Solche konkreten externen Änderungen werden vor Durchführung getrennt benannt. Bestehende Logs dürfen weder Schlüssel noch rohe Suchbegriffe, Suchvorschauen oder Dokumentinhalte aufnehmen; technische Diagnosen verwenden den Server-Runtime-Logger.

## Kritische Invarianten und geplanter Nachweis

| Invariante                                                            | Nachweis vor Auslieferung                                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Keine Suche in einem fremden Instanz-/Quellkontext                    | Negative Tests für manipulierte IDs, falsche Umgebung und fremde Gemeinde                                      |
| Nur berechtigt lesbare Inhalte erreichen Browser, Vorschau und Filter | Gemischte Kandidatenbatches mit Typ-, Own-, Organisations- und Mainserver-Scope-Prüfung; Facetten-Negativtests |
| Kein alter Kontext nach Organisationswechsel                          | Überholte Anfrage und Kontextwechsel während Suche/Zählung testen                                              |
| Keine Rechteumgehung durch GenericItem-Klassifikation                 | Fachtypen mit fehlendem Fachrecht, unbekanntem Diskriminator und kollidierenden IDs testen                     |
| Exakte Zahlen nur bei vollständiger Prüfung                           | Mehrere Upstream-Seiten, Ablehnungen, ungeklärte Kandidaten, Zeit-/Indexlimits und geänderte Filter testen     |
| Keine Schlüssel oder ausgeschlossene Dokumentinhalte im Client        | Browser-Bundle/Netzwerkantworten und Logging-Pfade gezielt prüfen                                              |
| Kopfzeile und Ergebnisseite bleiben bedienbar                         | Desktop-/Mobil-Flow, Tastatur, Fokus, Zurücknavigation und Fehlerzustände prüfen                               |

## Lieferung und Rücknahme

Die Lieferung erfolgt als Erweiterung des bestehenden Suchplugins und seines Host-Wirings. Zuerst werden Kandidatenzuordnung, bestehende Leseprüfung und Zählsemantik mit dem kleinsten echten Unit-/Type-Gate abgesichert, anschließend Oberfläche und Integration. Die schriftlichen Spezifikationen und kritischen Invarianten bleiben vor Implementierung prüfbar.

Die Funktion wird zunächst in Dev mit getrenntem, eingeschränktem Suchzugang erprobt. Eine Rücknahme deaktiviert das optionale Plugin und entfernt damit Header-Einstieg sowie Route/Handler-Zugriff. Mainserver-Indizes und die bestehende SQL-Inhaltssuche benötigen keine Rückmigration. Reguläre spätere Rollouts folgen ausschließlich `docs/guides/studio-rollout-process.md`.

### Erster fachlicher Live-Test

Als erster Testmandant ist Sandbox mit Mainserver Staging vorgesehen. Die Auswahl autorisiert noch keine Konfiguration, Schlüsselanlage oder Bereitstellung.


## Bestätigte UX-Anpassung vom 8. November 2026

Der Nutzer bestätigt die übliche StudioDataTable mit Titel, Inhaltstyp, Datenanbieter, Kategorien, Spaltensortierung, Filtern und Paging. Das einzige Suchfeld bleibt auf allen Ansichten im Header, auch mobil; auf der Ergebnisseite gibt es keine zweite Eingabe. Suchbegriff, Filter, Sortierung und Paging bleiben in der URL. Die Sortierung erfolgt nach der Rechteprüfung und vor dem Paging auf der tatsächlich geprüften Treffermenge; unvollständige Läufe bleiben als solche erkennbar.

Die Suche erzwingt keinen Organisationsprincipal mehr. Sie nutzt die vorhandene automatische Credential-Auflösung für die aktive Sitzung und Organisationsrichtlinie und übergibt den so bestimmten Principal weiterhin explizit an die bestehenden autorisierenden Detailrouten. Es gibt keine Vereinigung aller Organisationen und keinen Wechsel zu einem anderen Zugang nach einer Ablehnung. Die frische Kontext-/Credentialprüfung nach dem Lauf bleibt erhalten. Globale Kontosteuerung, Schreibaktionen, Indizes, Secrets und Rollout-Konfiguration gehören nicht zum Änderungsscope.

Nachweise: UI-Test für genau ein dauerhaftes Header-Suchfeld, URL-Synchronisierung und Filtererhalt; DataTable-Sortier-/Filtertest; Engine-Test für Sortierung vor Paging; Host-Test für automatische Auswahl und unveränderte Detailautorisierung; gezielte Typechecks, i18n, Server-Runtime und Dateiplatzierung.
