## 1. Abo-Ende und Versandgrenze

- [ ] Waste-Schema, Migration und Abo-/Outbox-Verbraucher auf nullable Adressdaten für beendete Abos prüfen. Schema-SQL und Schemareferenz aktualisieren.
- [ ] Aktivierung an Token, Status und gültigen Ablaufzeitpunkt im atomaren Update binden. Die Pending-Bereinigung ausschließlich nach der gespeicherten Gültigkeit auslösen.
- [ ] Versandclaim, Abo-Widerruf und Ablaufbereinigung am Abo serialisieren. Erfolgsantwort, Rollback, begrenzten Versandversuch und Wiederaufnahme nach Prozessabbruch prüfen.
- [ ] Adresse und Adresshash in der Abmelde-Transaktion entfernen. Persistierte Aufträge einschließlich bereits gesendeter Einträge und freier Fehlertexte auf die benötigten Metadaten reduzieren.
- [ ] Den Altbestand zuerst mit Anzahl, Einschlussregeln, Ausnahmen und erwarteten Änderungen erfassen. Einen produktiven Lauf erst nach Freigabe ausführen und unabhängig zurücklesen.

## 2. Suche im vorhandenen Monitoring

- [ ] Vollständige Adressen im POST-Body validieren und Normalisierung und Hashbildung mit der Anmeldung teilen. Die bestehende Monitoring-Autorisierung und den Methodenschutz verwenden.
- [ ] Paginierte Treffermenge und Trefferzahl mit exakt demselben Hash- und Aktivprädikat abrufen. Maskierte Antwort mit `Cache-Control: no-store` ausgeben.
- [ ] Das Suchformular in der vorhandenen Ansicht umsetzen. Bei Suchänderung, Wechsel des Mandanten oder Verlust des Zugriffs keine alte Antwort ausgeben.

## 3. Nachweise und Dokumentation

- [ ] PostgreSQL-Tests für Ablaufgrenze, gleiche Zeitstempel, Aktivierung gegen Abmeldung, laufenden und abgestürzten Dispatcher sowie wiederholten Widerruf ausführen.
- [ ] Über alle gespeicherten Versandzustände prüfen, dass Adresskopien nach Ende des Abos entfernt sind. Abmeldelink wiederholen und anschließend denselben Hash vergeblich suchen.
- [ ] Nachweisen, dass mehrere aktive Treffer möglich sind. Pending vor und nach DOI, abgemeldet, abgelaufen, anderer Mandant, unvollständige Adresse, direkter Request ohne Recht und Abbruch eines UI-Requests abdecken.
- [ ] URL, Fehler, Logs und Telemetrie mit synthetischer Adresse und Digest prüfen. Den kombinierten Server-, UI-, Schema- und Berechtigungsnachweis auf den exakten Stand beziehen.
- [ ] [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [Querschnittskonzepte](../../../docs/architecture/08-cross-cutting-concepts.md) beim bestehenden Monitoring- und Dispatchpfad aktualisieren.
