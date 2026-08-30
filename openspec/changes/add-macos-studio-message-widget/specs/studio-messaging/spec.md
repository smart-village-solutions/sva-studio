## ADDED Requirements

### Requirement: Allgemeiner autorisierter Studio-Nachrichtenfeed

Das System SHALL einen allgemeinen, versionierten Studio-Nachrichtenfeed bereitstellen, der typisierte Quellen ausschließlich im aktiven Instanz- und Accountkontext aggregiert. Der Feed MUST stabile Nachrichten-IDs, Quelle, Titel, begrenzten Kurztext, Priorität, Sensitivität, sicheres relatives Ziel und Gelesen-Status liefern.

#### Scenario: Update-Log ist die erste Nachrichtenquelle

- **WENN** ein aktiver Studio-Benutzer den Nachrichtenfeed lädt
- **DANN** werden die aktuell ausgelieferten Update-Log-Einträge als Nachrichten der Quelle `studio-changelog` bereitgestellt
- **UND** verwendet jeder Eintrag eine stabile ID aus seiner PR-Nummer
- **UND** existiert keine zweite fachliche Changelog-Datenquelle

#### Scenario: Nicht sichtbare Nachricht bleibt verborgen

- **WENN** ein Provider eine Nachricht liefert, deren Audience nicht zum aktiven Instanz- und Accountkontext passt
- **DANN** erscheint die Nachricht weder in der Liste noch im Ungelesen-Zähler
- **UND** kann ein Client ihre Existenz nicht anhand differenzierter Fehler erkennen

### Requirement: Getrennte Summary-, Listen- und Gelesen-Endpunkte

Das System SHALL die Anzahl ungelesener Nachrichten ohne Nachrichtentexte, begrenzte Nachrichtenlisten und Gelesen-Mutationen über getrennte versionierte Account-Endpunkte bereitstellen. Accountbezogene Antworten MUST einen privaten `no-store`-Cachevertrag verwenden.

#### Scenario: Kleines Widget lädt nur den Zähler

- **WENN** ein autorisierter Client die Nachrichten-Summary lädt
- **DANN** enthält die Antwort die Anzahl ungelesener sichtbarer Nachrichten und den Aktualisierungszeitpunkt
- **UND** enthält sie keine Titel, Kurztexte oder Nachrichtenziele

#### Scenario: Listenlimit wird serverseitig begrenzt

- **WENN** ein autorisierter Client eine Nachrichtenliste mit einem ungültigen oder zu großen Limit anfordert
- **DANN** lehnt die API ungültige Werte mit einem stabilen Fehlercode ab oder begrenzt sie auf das dokumentierte Maximum von 20
- **UND** bestimmt der Client niemals selbst Audience, Instanz oder Account

#### Scenario: Sensible Antwort wird nicht zwischengespeichert

- **WENN** die API Summary, Liste oder Gelesen-Ergebnis zurückgibt
- **DANN** verhindern die Response-Header gemeinschaftliche oder persistente HTTP-Caches
- **UND** enthalten Fehler weder Token noch Nachrichtentexte

### Requirement: Serverseitiger Gelesen-Stand

Das System SHALL den Gelesen-Stand pro Instanz, Account und stabiler Nachrichten-ID serverseitig und idempotent persistieren, ohne Nachrichteninhalt zu duplizieren.

#### Scenario: Widget-Aktualisierung verändert keinen Gelesen-Stand

- **WENN** ein Widget Summary oder Nachrichtenliste im Hintergrund lädt
- **DANN** bleibt der Gelesen-Stand aller Nachrichten unverändert

#### Scenario: Erfolgreich dargestellte Nachricht wird gelesen

- **WENN** der Studio-Nachrichtenbereich sichtbare Nachrichten erfolgreich dargestellt hat
- **DANN** markiert er genau diese IDs idempotent als gelesen
- **UND** sinkt der Ungelesen-Zähler entsprechend

#### Scenario: Fremde ID kann nicht markiert werden

- **WENN** ein Client eine unbekannte, tenantfremde oder für den Account nicht sichtbare Nachrichten-ID als gelesen markieren will
- **DANN** entsteht kein Gelesen-Beleg für diese ID
- **UND** bleibt die Operation fail-closed

### Requirement: Instanzisolierte Gelesen-Belege

Das System MUST Gelesen-Belege über einen zusammengesetzten Membership-Fremdschlüssel, erzwungene RLS und serverseitig gebundenen Accountkontext isolieren. Die Persistenz MUST auf ID, Instanz, Account und Gelesen-Zeitpunkt begrenzt bleiben.

#### Scenario: Tenantübergreifender Zugriff wird durch Datenbankgrenze verhindert

- **WENN** der Datenbankkontext auf Instanz A gesetzt ist
- **UND** eine Operation Belege aus Instanz B lesen oder schreiben will
- **DANN** blockiert die erzwungene RLS die Operation

#### Scenario: Membership wird entfernt

- **WENN** eine Account-Membership gelöscht wird
- **DANN** werden ihre Gelesen-Belege für diese Instanz über den Fremdschlüsselvertrag entfernt
- **UND** bleiben Belege anderer Instanzen unverändert

### Requirement: Automatische Widget-Darstellung nach Größe

Das System SHALL die Widget-Inhalte automatisch an die Widget-Familie anpassen und keine manuelle Nachrichtenanzahl verlangen.

#### Scenario: Kleines Widget

- **WENN** das Widget als `systemSmall` dargestellt wird
- **DANN** zeigt es ausschließlich die Anzahl ungelesener Nachrichten und einen neutralen Status
- **UND** lädt es keine Nachrichtentexte

#### Scenario: Mittleres Widget

- **WENN** das Widget als `systemMedium` dargestellt wird
- **DANN** zeigt es höchstens die drei neuesten sichtbaren Nachrichten

#### Scenario: Großes Widget

- **WENN** das Widget als `systemLarge` dargestellt wird
- **DANN** zeigt es höchstens die fünf neuesten sichtbaren Nachrichten

### Requirement: Datenschutzfreundliche Widget-Zustände

Das System MUST Titel und Nachrichtentexte als privacy-sensitive behandeln und im gesperrten oder redigierten Zustand durch eine neutrale Anzahl ersetzen. Token und Nachrichtentexte dürfen nicht in Preferences, eigenen Klartext-Caches, Logs oder Telemetrie persistiert werden.

#### Scenario: Mac ist gesperrt

- **WENN** macOS den privacy-sensitive Widget-Inhalt redigiert
- **DANN** sind Titel und Kurztexte nicht sichtbar
- **UND** bleibt höchstens eine neutrale Angabe wie „3 neue Studio-Nachrichten“ sichtbar

#### Scenario: Native Sitzung ist abgelaufen

- **WENN** das Widget keine gültige native Sitzung erneuern kann
- **DANN** zeigt die nächste Timeline einen neutralen Zustand „Anmeldung erforderlich“
- **UND** enthält der Zustand keine sensitiven Fehlerdetails

#### Scenario: Benutzer meldet sich ab

- **WENN** der Benutzer sich in der nativen Begleit-App abmeldet
- **DANN** werden native Credentials und abgeleitete lokale Zustände gelöscht
- **UND** werden alle Widget-Timelines zur Neuladung aufgefordert

### Requirement: Sichere Widget-Deep-Links

Das System SHALL Widget-Interaktionen ausschließlich auf allowlist-validierte Studio-Ziele führen. Das kleine Widget SHALL den Nachrichtenbereich öffnen; Listenzeilen SHALL die konkrete Nachricht öffnen.

#### Scenario: Kleines Widget wird aktiviert

- **WENN** ein Benutzer das kleine Widget aktiviert
- **DANN** öffnet das System den authentifizierten Studio-Nachrichtenbereich

#### Scenario: Nachricht wird aktiviert

- **WENN** ein Benutzer eine sichtbare Nachricht im mittleren oder großen Widget aktiviert
- **DANN** öffnet das System das zugehörige relative Studio-Ziel
- **UND** wird die Nachricht erst nach erfolgreicher Darstellung als gelesen markiert

#### Scenario: Unsicheres Ziel wird geliefert

- **WENN** ein Provider ein externes, absolutes oder protokollfremdes Ziel liefert
- **DANN** verwirft die Feed-Grenze das Ziel beziehungsweise die Nachricht fail-closed

### Requirement: Widget ist kein garantierter Alarmkanal

Das System MUST dokumentieren und in der Oberfläche klar vermitteln, dass WidgetKit-Aktualisierungen vom Betriebssystem geplant werden und keine garantierte Echtzeit- oder Eskalationszustellung darstellen.

#### Scenario: Kritische Nachricht benötigt garantierte Zustellung

- **WENN** eine zukünftige Nachricht eine garantierte oder fristgebundene Zustellung benötigt
- **DANN** darf die Fachfunktion das Widget nicht als alleinigen Zustellnachweis verwenden
- **UND** benötigt Push-, Bestätigungs- oder Eskalationslogik einen getrennten Vertrag
