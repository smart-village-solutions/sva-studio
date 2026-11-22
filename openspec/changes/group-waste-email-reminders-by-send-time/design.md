## Fachliche Identität

Der Planer ermittelt je Abo wie bisher Fraktion, gewählten Slot, wirksames Abholdatum, berechneten Versandzeitpunkt und Tourhinweise. Die bestehende fachliche Identität eines Mitglieds ist Abo, Fraktion, Slot und wirksames Abholdatum. Die Gruppenidentität enthält Abo, wirksames Abholdatum und den berechneten ursprünglichen Versandzeitpunkt. Ein wiederholter Versuch darf `send_at` verschieben. Er verwendet dieselbe Gruppenidentität und dieselben fachlichen Mitglieder.

Der Planer sortiert die Fraktionen und dedupliziert gleiche Hinweise pro Fraktion. Mehrere Slots derselben Fraktion, die zum selben Zeitpunkt fällig sind, können dieselbe dargestellte Fraktion haben. Ihre fachlichen Mitgliedskennungen bleiben für den Abgleich erhalten. Abholungen mit verschiedenem Datum bleiben auch bei identischem Versandzeitpunkt getrennt.

## Outbox und Verbrauch

- Die bestehende Outbox speichert den eindeutigen Schlüssel und die Mitgliedskennungen im Versandauftrag. Für die neue Auftragsform werden Darstellung und Inhalt beim Einlesen validiert. Bestehende Einzelaufträge liefern ihren Mitgliedsbezug aus dem vorhandenen Deduplizierungsschlüssel. Die Definition ergänzt die Verarbeitung des bestehenden Auftrags und verwendet die vorhandene Mail-Transport-Schnittstelle.
- Der Auftrag führt alle Fraktionsnamen und ihre passenden Hinweise in stabiler Reihenfolge auf. Vorhandene Vorlagenplätze bleiben benutzbar. `{{fractionName}}` erhält bei einer Sammelmail die Liste der enthaltenen Fraktionen. Der wirksame Tag, Adresse und Abmeldelink sind für die gesamte Nachricht eindeutig. Die vorhandene Monitoring-Darstellung liest Einzeleinträge und mehrere Fraktionen.
- Die Materialisierung und der Dispatch prüfen den aktuellen Abozustand. Ein widerrufenes Abo darf keine neue Versandfreigabe erhalten. Die Verarbeitung nutzt die vorhandene Consent-Grenze und, sobald umgesetzt, dieselbe Abo-Sperre wie Widerruf und Adresslöschung aus `protect-waste-email-subscription-addresses`.

## Übergang, parallele Verarbeitung und Wiederholung

Der Rollout führt zuerst einen Dispatcher ein, der beide Auftragsformen lesen und laufende Claims sicher behandeln kann. Die Gruppenmaterialisierung beginnt erst, wenn alte Materialisierer und Dispatcher keine Aufträge mehr erzeugen oder beanspruchen. Vor der Umschaltung wird der betroffene offene Bestand nach Status und Claim inventarisiert. Der Nachweis für die Umschaltung umfasst den tatsächlichen Abschluss alter Prozesse und die Rücklesung der ersten neu erzeugten Gruppen.

- Ein bereits gesendeter Einzel- oder Gruppenauftrag beansprucht seine fachlichen Mitglieder dauerhaft. Gleiches gilt vorläufig für geclaimte Mitglieder mit ungeklärtem Ausgang. Beim Wechsel von Einzelaufträgen enthält die erste Gruppe nur die übrigen noch versendbaren Mitglieder. Der Inhalt einer Gruppe bleibt nach begonnener Übergabe eingefroren. Eine spätere Ergänzung derselben Gruppe löst ohne gesonderte fachliche Entscheidung keinen automatischen Nachversand aus.
- Beim Erzeugen der entsprechenden Gruppen ersetzt der Planer sicher wartende Einzelaufträge in derselben Transaktion. Er sperrt offene Altaufträge, prüft Zustand und Mitgliedschaft erneut, storniert betroffene Altaufträge und speichert die Gruppen. Ein konkurrierender Claim darf weder beide Auftragsformen freigeben noch ein Mitglied aus beiden entfernen.
- Bei einem Crash vor Commit bleibt der bisherige Auftrag gültig. Nach Commit stellen derselbe Schlüssel und dieselben Mitglieder bei einem erneuten Lauf denselben fachlichen Zustand her. Für zwei parallel materialisierte Änderungen werden die betreffenden Aufträge in derselben Reihenfolge gesperrt. Eindeutige bestehende Outbox-Schlüssel bleiben die technische Sicherung gegen doppelte Gruppen.
- Ein sicher vor der Provider-Annahme gescheiterter Versuch kann den bestehenden Retry-Pfad verwenden. Ein Abbruch nach Versandfreigabe oder eine nicht verifizierbare Transportantwort führt zu einem ungeklärten Ausgang. Ein abgelaufener Claim allein erlaubt keine neue Übergabe. Solange der Ausgang offen ist, darf der Planer dieselben Mitglieder weder über die Gruppe noch über einen Einzelauftrag erneut freigeben. Bei gesichertem Nichtversand kann der zuständige Betrieb einen Retry auslösen. Dieser prüft erneut Einwilligung und Mitgliedszustand.

## Geplante Ende-zu-Ende-Nachweise

- Ein wirksamer Abholtag mit zwei Fraktionen und gemeinsamer Ursprungszeit erzeugt einen Auftrag. Dieselben Fraktionen bei unterschiedlichen Versandzeitpunkten, verschiedenen Abholdaten oder in verschiedenen Abos erzeugen getrennte Aufträge.
- Neuer Eingang, bereits gesendeter Einzelauftrag, ausstehender Einzelauftrag, laufender Claim und gemischte Mitgliedsgruppen werden im echten PostgreSQL-Abgleich geprüft. Maßgeblich ist die Zahl der tatsächlich freigegebenen Mitglieder und Provider-Aufrufe.
- Zwei Worker, Crash vor Commit, Crash nach Claim, angenommene Nachricht mit verlorener Antwort, definitive Ablehnung und verschobener Retry-Termin werden als getrennte Fälle mit testbarem Transport simuliert. Eine zwischenzeitliche Abmeldung verhindert jeden neuen Übergabeversuch.
- Die Anzeige wird für alte und neue Auftragsformen mit Fraktionen, Hinweisen, unklarem Versandstatus und genau einem Abmeldelink geprüft. Testdaten und Nachweise enthalten keine echten Adressen.
