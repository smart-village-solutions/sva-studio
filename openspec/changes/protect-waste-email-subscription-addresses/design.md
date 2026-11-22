## Ausgangspfade

`email-reminders.tokens.ts` liest die Gültigkeit des DOI-Tokens vor dem Aktivierungs-Update. `email-reminders.subscriptions.ts` verknüpft die Bereinigung zusätzlich mit dem Alter des Datensatzes. Die Statusänderung der Abmeldung und die Stornierung von Aufträgen sind getrennt. `email` und `email_hash` sind derzeit Pflichtfelder. Adressen können außerdem in `payload.addresses`, freien Versandfehlern oder weiteren Feldern gespeicherter Payloads vorkommen.

## Ablauf und Ausführungsgrenzen

### Aktivierung und Bereinigung

- Eine Aktivierung prüft Token, Status `pending` und `expires_at > Prüfzeitpunkt` in derselben atomaren Änderung. Der Prüfzeitpunkt wird nach Erwerb der Sperre ermittelt. Am gespeicherten Ablaufzeitpunkt kann der Link bereits kein Abo mehr aktivieren. Eine Abmeldung oder Löschung im selben Zeitfenster kann einen Erfolg nur dann zurückliefern, wenn die passende Zustandsänderung tatsächlich erfolgt ist.
- Die Bereinigung verwendet den vorhandenen Lauf und `expires_at <= Prüfzeitpunkt`. Die Konfiguration darf die erzeugte Gültigkeit begrenzen. Eine zusätzliche Mindestliegezeit nach Ablauf entfällt.
- Fällige Pending-Datensätze werden zusammen mit ihren Aboelementen und Outbox-Zeilen gelöscht, sobald der begrenzte laufende Versandversuch die Sperre freigibt. Bei einem Worker-Abbruch rollt PostgreSQL die Transaktion zurück und gibt die Zeilensperre frei. Eine abgelaufene Anmeldung darf danach weder erneut beansprucht werden noch zur Aktivierung zurückkehren.

### Widerruf und Versand

- Die Abozeile ist die gemeinsame Sperrgrenze. Vor der externen Übergabe sperrt der Worker diese Zeile, prüft danach den aktuellen Status und bei DOI die Frist, bestätigt den gültigen Dispatch-Claim und führt die Übergabe mit begrenzter Laufzeit aus. Der Worker hält die Sperre bis zur Rückmeldung oder bis zum Abbruch des lokalen Versandversuchs. Der Abruf fälliger Outbox-Aufträge darf währenddessen keine Sperre in umgekehrter Reihenfolge halten.
- Die Abmeldung erwirbt dieselbe Sperre. Der Statuswechsel, das Entfernen von Adresse und Hash und das Stornieren offener Aufträge erfolgen in einer Transaktion. Für die Adresslöschung werden die beiden Felder nullable. Ein Status-Constraint schützt die vorhandene Annahme, dass `pending` und `active` Adresse und Hash besitzen.
- Der Auftrag bewahrt nach Abo-Ende nur die für die aktuelle Versandübersicht erforderlichen strukturierten Metadaten. Empfänger, Links und Tokens, vollständiger Nachrichtentext, freie Providerfehler und Adresskopien entfallen auch aus bereits abgeschlossenen Aufträgen. Zustandsfelder der Aufträge und die für die wiederholbare Abmeldebestätigung erforderliche Abo-Kennung und Tokenprüfung bleiben erhalten. Der öffentliche Bestätigungspfad benötigt das bisherige Ortslabel dafür nicht.
- Erst nach Commit bestätigt die öffentliche App den Widerruf. Ein Crash vor dem Commit lässt die Transaktion zurückrollen und den Link erneut verwendbar. Bei einem Crash oder Timeout nach einer begonnenen Übergabe kann die externe Annahme offen sein. Eine spätere Wiederaufnahme respektiert den inzwischen widerrufenen Abozustand und darf keinen neuen Versand auslösen.

### Berechtigte Adresssuche

- Die UI sendet genau eine vollständige Adresse im Body einer geschützten POST-Route. Sie startet bei Seite eins und bindet Antwort und Paginierung an die aktive Instanz und aktuelle Suche. Ein Sessionwechsel verwirft alte Suchergebnisse.
- Der Server prüft vor dem Adressabgleich das bestehende Recht `waste-management.email-reminder-monitoring.read` in der authentifizierten Instanz. Der vorhandene Schutz für schreibende HTTP-Methoden greift auch für diese lesende Abfrage.
- Ein gemeinsam verwendeter serverseitiger Pfad normalisiert und hasht die Adresse genauso wie die öffentliche Anmeldung. Die Abfrage nutzt den aktuellen gespeicherten Hash, `status = 'active'` und ausschließlich die Waste-Datenquelle der aktiven Instanz. Liste und Trefferzahl verwenden dasselbe Prädikat. Die mandantenweite Gesamtzahl aktiver Abos ist weiterhin unabhängig davon.
- Die Suche antwortet mit den vorhandenen maskierten Zeilen und `Cache-Control: no-store`. Adresse und Digest bleiben aus URL, Antworten, Logs, Traces, Fehlermeldungen und persistentem Browserzustand heraus.

## Altbestand und Nachweise

Vor einer Bereinigung vorhandener abgemeldeter oder abgelaufener Datensätze wird deren Umfang lesend bestimmt. Der Plan weist alle betroffenen Spalten und Payload-Felder, die Auswirkung auf offene Claims und den erwarteten Umfang je Status aus. Wiederholung muss auf demselben Bestand keine weitere Änderung erzeugen. Der Rücklesetest prüft die drei Speicherorte Abo, Outbox und Hashsuche mit synthetischen Adressen, bevor ein produktiver Lauf gesondert freigegeben wird.

Die kritischen Invarianten sind eine atomare Sperrgrenze zwischen Bestätigung, Widerruf und Versand, das vollständige Entfernen der operativen Adresse und die Instanzgrenze der Suche. Für den exakten Implementierungsstand sind PostgreSQL-Tests mit zwei Verbindungen, ein angehaltener Test-Transport und negative API-/Telemetrieprüfungen erforderlich.
