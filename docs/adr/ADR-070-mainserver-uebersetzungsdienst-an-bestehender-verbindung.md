# ADR-070: Technischen Übersetzungsdienst an bestehender Main-Server-Verbindung autorisieren

**Status:** Accepted für den ausdrücklich freigegebenen kleinen Durchstich, keine Live-Einrichtung
**Datum:** 27. Oktober 2026

## Kontext und Entscheidung

Der Main-Server benötigt für eine Nachricht auf Englisch einen begrenzten Studio-/DeepL-Aufruf. Bestehende Session-Katalogoperationen und der SSF-Rollenvertrag sind dafür keine technische Autorisierung.

Die bestehende `sva_mainserver`-Default-Schnittstelle je Studio-Instanz trägt unter `publicConfig.translationService` ausschließlich erwarteten `issuer`, `clientId`, konkretes `subject` und geeignete `audience`. Vertrauenswürdig konfigurierte Werte werden nie aus einem Aufruf registriert. Der Request-Mandant ist nur Lookup. `verifyServiceJwt()` prüft Signatur, Issuer, Audience und Ablauf; der Handler prüft zusätzlich `azp` und exaktes `sub`. Menschliche Logins desselben Clients erhalten keine technische Befugnis. Keine zusätzliche Übersetzungsrolle, Bindingregistry oder menschliche Accountanlage.

Die Instanz-/Municipality-Bindung stammt aus der bestehenden Default-Schnittstelle und deren ausdrücklich erwarteter technischer Identität. Der begrenzte Adapter nutzt ausschließlich instanzgebundene Schnittstellen-/DeepL-Konfiguration, keine Organisationsinhalte oder Katalogbestände; er wählt deshalb keine Organisation oder Seed-Organisation aus. `organization_mainserver_credentials.technical_account_id` gehört zum ausgehenden Studio→Main-Server-Zugang und ist ausdrücklich **nicht** mit dem eingehenden Service-Subject gleichzusetzen. Kein neuer Account oder zweite fachliche Zuordnung. Aktive Instanz, Modul-/Lifecyclegeneration sowie aktuelle Sprache und Zugangsversion werden vor Anbieterarbeit und Antwort geprüft. Organisationsgebundene Inhaltsprüfung und Ergebnisspeicherung bleiben beim Main-Server; weitergehende organisationsgebundene Studio-Funktionen sind nicht Bestandteil dieses Endpunkts. Die reale Eignung der vorhandenen Serviceidentität/Audience muss vor Live-Nutzung nachgewiesen werden.

Der direkte `POST /api/v1/app-translations/translate` verarbeitet nur `news-v1`, Deutsch→Englisch, begrenzte vollständige Textgruppen. Keine Studio-Persistenz dynamischer Texte, keine zweite Queue; Main-Server besitzt Auftrag und Retry. Bestehende Plattform-/Modul- und redaktionelle Berechtigungen bleiben unverändert. Unverändertes URL-Speichern erhält die technischen Identitätsmetadaten; Adresswechsel oder Deaktivierung widerrufen sie.

## Folgen und Nachweise

Kein Token, Original- oder Ergebnistext wird durch diesen Handler geloggt. HTML muss dem vorhandenen Rich-Text-Schutzprofil entsprechen; unveränderte Tag-/Attributfolge und vollständige Ergebnisgruppe sind Voraussetzung. Unbekannter Abschluss kann bei Main-Server-Retry erneut DeepL-Kosten verursachen, kein Exactly-once. Die fünfsekündige App-Anzeigegrenze ist unabhängig vom begrenzten Studio-/Provideraufruf.

Gezielte Handler-/Settings-/Routingtests sichern Identitäts-/Mandantenablehnung, Metadatenerhalt, vollständige Antworten und Strukturprüfung. Ein realer Main-Server-/Studio-/DeepL-Aufruf und konkrete Audience-/Subjectevidenz bleiben gesonderte Abnahme. Siehe [Planungs- und Dienstvertrag](../../openspec/changes/add-central-app-translations/design.md).

## Ergänzung vom 30. Oktober: automatische lokale Einrichtung

Nach ausdrücklicher Freigabe beider Repositories richtet der bestehende Modul-Lifecycle die Bindung über `GET /api/v1/app_translations/service_identity` des administrativ zugeordneten Mainservers ein. Dessen kommunaler Keycloak-Client bestätigt die eigene Identität durch Introspektion eines vorhandenen Client-Credentials-Dienstausweises. Die öffentliche Antwort enthält nur `schemaVersion`, `instanceId`, `studioUrl` und die vier Bindungsfelder; keine Token oder Secrets. Keine neue IAM-Rolle, Kontoanlage oder Requestregistrierung.

Studio prüft Mainserver und Issuer mit dem bestehenden Public-Upstream-Schutz. Das Ziel entspricht exakt der Dienst-Route auf dem registrierten Instanzhost oder der zentralen serverseitigen `SVA_PUBLIC_BASE_URL`; die Instanz bleibt in beiden Fällen exakt gebunden. Provisionierung, Reconcile und Reaktivierung verwenden genau ihren beanspruchten Auftrag. Beim Speichern schützen Sperren, Auftragsgeneration und `xmin` vor konkurrierenden Änderungen. Ausschließlich der konkrete Reaktivierungsauftrag darf noch während `suspended` vorbereiten; technische Übersetzungsanfragen verlangen weiterhin `active`.

Bei fehlender oder widersprüchlicher Auskunft bleibt die Freigabe aus; vorhandene abweichende manuelle Bindungen werden nicht ersetzt. Ein nicht blockierender Readiness-Check verweist auf Zuordnung und Modulabgleich. Beide Änderungen sind lokal, kein Rolloutnachweis. Später muss der Mainserver-Endpunkt vor dem Studio-Anschluss verfügbar sein. Der vollständige Vertrag und die lokalen Nachweise stehen im [bestehenden Plan](../../openspec/changes/add-central-app-translations/design.md#64-automatische-servicefreigabe-bei-modulaktivierung--auftrag-vom-30-oktober).

### Ergänzung: fehlende Mainserver-Einrichtung nachholen

Der Folgeauftrag erweitert denselben Anschluss um einen authentifizierten `POST`, wenn die lesende Auskunft 404/503 liefert und Studio noch keine Dienstbindung besitzt. Der bestehende aktive technische Organisationszugang autorisiert nur diesen ausgehenden Verwaltungsaufruf; er wird weiterhin nicht als eingehendes Service-Subject verwendet. Bei mehreren geeigneten Organisationen entscheidet die stabile Organisations-ID-Reihenfolge. Kein persönlicher Zugang und keine Seed-Organisation als Fallback.

Mainserver ergänzt ausschließlich das passende fehlende Studio-Ziel und die notwendige feste Audience/Serviceaccount-Fähigkeit des vorhandenen vertraulichen Clients. Er verwendet dafür seine bereits gespeicherten Keycloak-Verwaltungscredentials; Studio erhält sie nicht. Fremde Zielkonfiguration, ungeeigneter Client oder widersprüchlicher Mapper werden nicht überschrieben. Eine erfolgreiche Introspektion und unveränderte Mainserver-Identitätsparameter sind vor dem Speichern zwingend. Partielle Keycloak-Ergänzungen dürfen bei einem Fehler bestehen bleiben; der nächste ausdrückliche Aktivierungs-/Abgleichlauf ist wiederholbar. Ein Deaktivieren entfernt keine gemeinsam verwendeten Keycloak-Einstellungen; der bestehende Studio-Modulguard widerruft den Dienstzugang.

Diese Ergänzung ist lokal geprüft. Erst nach Veröffentlichung des Mainserver-Anschlusses und danach von Studio kann das Aus-/Einschalten in der Sandbox die Einrichtung auslösen. Production- und Pilotdaten wurden nicht verändert.
