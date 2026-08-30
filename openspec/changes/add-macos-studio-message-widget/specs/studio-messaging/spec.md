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

#### Scenario: Cookie-authentifizierte Mutation wird gesendet

- **WENN** ein Browser eine Gelesen-Mutation oder Browser-Übergabe über seine `httpOnly`-Session anfordert
- **DANN** validiert der Endpunkt den bestehenden CSRF-Nachweis und erlaubten Origin vor der Mutation
- **UND** wird ein fehlender oder ungültiger Nachweis fail-closed abgelehnt
- **UND** verwendet ein nativer Bearer-Request ausschließlich seine Tokenbindung und fällt nicht auf eine beigefügte Cookie-Session zurück

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

Das System MUST Gelesen-Belege über referenzielle Instanz-/Accountintegrität, erzwungene RLS und serverseitig gebundenen Accountkontext isolieren. Membership-Cleanup MUST den bestehenden Legal-Hold-Vertrag einhalten. Eine unter Legal Hold stehende Membership MUST deshalb zuerst dauerhaft für normale Autorisierung widerrufen und erst nach Aufhebung des Holds physisch gelöscht werden. Die Persistenz MUST auf ID, Instanz, Account und Gelesen-Zeitpunkt begrenzt bleiben.

#### Scenario: Tenantübergreifender Zugriff wird durch Datenbankgrenze verhindert

- **WENN** der Datenbankkontext auf Instanz A gesetzt ist
- **UND** eine Operation Belege aus Instanz B lesen oder schreiben will
- **DANN** blockiert die erzwungene RLS die Operation

#### Scenario: Membership wird entfernt

- **WENN** eine Account-Membership gelöscht wird
- **DANN** endet der normale Feed- und Belegzugriff für diese Instanz sofort
- **UND** entfernt der Governance-Workflow die Gelesen-Belege nur ohne aktiven Legal Hold
- **UND** bleiben Belege anderer Instanzen unverändert

#### Scenario: Membership wird unter Legal Hold entzogen

- **WENN** eine Account-Membership bei aktivem Legal Hold entzogen werden soll
- **DANN** wird sie atomar als widerrufen markiert und nicht physisch gelöscht
- **UND** schließen alle Autorisierungs- und Feed-Abfragen die widerrufene Membership sofort aus
- **UND** bleiben ihre Gelesen-Belege bis zur Aufhebung des Holds instanz- und accountgebunden erhalten
- **UND** sind sie für normale Studio-Requests nicht mehr sichtbar
- **UND** kann ausschließlich der autorisierte DSR-/Governance-Pfad darauf zugreifen
- **UND** werden die vorgemerkte physische Membership- und Beleglöschung nach Aufhebung des Holds nachgeholt

#### Scenario: Aufbewahrungsfrist wird nach einer Bereinigung verlängert

- **WENN** Belege bereits bereinigt wurden
- **UND** ein Administrator die gemeinsame Aufbewahrungsfrist anschließend verlängert
- **DANN** bleibt die bei der Bereinigung persistierte Sichtbarkeitsgrenze monoton erhalten
- **UND** werden zuvor ausgeblendete Nachrichten nicht erneut ohne Gelesen-Beleg sichtbar

#### Scenario: Nachricht rotiert aus dem sichtbaren Katalog

- **WENN** eine Nachricht wegen neuerer Einträge nicht mehr im begrenzten Anzeige-Katalog enthalten ist
- **DANN** bleibt ihre stabile ID mit `publishedAt` im vollständigen Runtime-Metadatenindex auflösbar
- **UND** kann die periodische Bereinigung ihren Beleg fristgerecht verarbeiten

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

#### Scenario: Benutzer wechselt den nativen Account

- **WENN** die Begleit-App von Account A zu Account B wechselt
- **DANN** löscht sie vor Aktivierung von Account B Credentials und abgeleitete Zustände von Account A
- **UND** veröffentlicht sie eine neutrale Timeline und fordert `reloadAllTimelines` an
- **UND** lädt sie Inhalte von Account B erst nach diesem Reset

### Requirement: Sichere und accountgebundene Widget-Deep-Links

Das System SHALL Widget-Interaktionen ausschließlich über die Container-App und eine kurzlebige, einmalig verwendbare Browser-Übergabe auf allowlist-validierte Studio-Ziele führen. Die Übergabe MUST serverseitig an die native Instanz, den nativen Account und das relative Ziel gebunden sein. Das kleine Widget SHALL den Nachrichtenbereich öffnen; Listenzeilen SHALL die konkrete Nachricht öffnen.

#### Scenario: Kleines Widget wird aktiviert

- **WENN** ein Benutzer das kleine Widget aktiviert
- **DANN** fordert die Container-App mit der nativen Sitzung eine accountgebundene Browser-Übergabe für das fest allowlist-validierte Ziel `{ kind: 'feed' }` an
- **UND** öffnet das System den Bereich nur unter einer passenden Browseridentität

#### Scenario: Nachricht wird aktiviert

- **WENN** ein Benutzer eine sichtbare Nachricht im mittleren oder großen Widget aktiviert
- **DANN** fordert die Container-App mit der nativen Sitzung eine accountgebundene Browser-Übergabe für das zugehörige relative Studio-Ziel an
- **UND** konsumiert das Studio die Übergabe höchstens einmal und nur unter einer passenden Browseridentität
- **UND** wird die Nachricht erst nach erfolgreicher Darstellung als gelesen markiert

#### Scenario: Browser verwendet einen anderen Account

- **WENN** die aktive Browser-Session nicht zu Instanz und Account der nativen Browser-Übergabe passt
- **DANN** verlangt das Studio eine passende Anmeldung beziehungsweise einen Accountwechsel
- **UND** stellt es vorher keinen Nachrichteninhalt dar
- **UND** verändert es vorher keinen Gelesen-Stand

#### Scenario: Browser-Übergabe ist ungültig

- **WENN** eine Browser-Übergabe abgelaufen, bereits verwendet oder nicht passend ist
- **DANN** wird sie fail-closed abgelehnt
- **UND** enthält die Ablehnung keine lesbaren Account-, Instanz- oder Nachrichteninformationen

#### Scenario: Unsicheres Ziel wird geliefert

- **WENN** ein Provider oder Client ein freies, externes, absolutes oder protokollfremdes Ziel liefert
- **DANN** verwirft die Feed-Grenze das Ziel beziehungsweise die Nachricht fail-closed

### Requirement: Widget ist kein garantierter Alarmkanal

Das System MUST dokumentieren und in der Oberfläche klar vermitteln, dass WidgetKit-Aktualisierungen vom Betriebssystem geplant werden und keine garantierte Echtzeit- oder Eskalationszustellung darstellen.

#### Scenario: Kritische Nachricht benötigt garantierte Zustellung

- **WENN** eine zukünftige Nachricht eine garantierte oder fristgebundene Zustellung benötigt
- **DANN** darf die Fachfunktion das Widget nicht als alleinigen Zustellnachweis verwenden
- **UND** benötigt Push-, Bestätigungs- oder Eskalationslogik einen getrennten Vertrag
