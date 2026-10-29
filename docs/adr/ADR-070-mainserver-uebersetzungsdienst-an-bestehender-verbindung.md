# ADR-070: Technischen Übersetzungsdienst an bestehender Main-Server-Verbindung autorisieren

**Status:** Accepted für den ausdrücklich freigegebenen kleinen Durchstich, keine Live-Einrichtung
**Datum:** 27. Oktober 2026

## Kontext und Entscheidung

Der Main-Server benötigt für eine Nachricht auf Englisch einen begrenzten Studio-/DeepL-Aufruf. Bestehende Session-Katalogoperationen und der SSF-Rollenvertrag sind dafür keine technische Autorisierung.

Die bestehende `sva_mainserver`-Default-Schnittstelle je Studio-Instanz trägt unter `publicConfig.translationService` ausschließlich erwarteten `issuer`, `clientId`, konkretes `subject` und geeignete `audience`. Vertrauenswürdig konfigurierte Werte werden nie aus einem Aufruf registriert. Der Request-Mandant ist nur Lookup. `verifyServiceJwt()` prüft Signatur, Issuer, Audience und Ablauf; der Handler prüft zusätzlich `azp` und exaktes `sub`. Menschliche Logins desselben Clients erhalten keine technische Befugnis. Keine zusätzliche Übersetzungsrolle, Bindingregistry oder menschliche Accountanlage.

Die Instanz-/Municipality-Bindung stammt aus der bestehenden Default-Schnittstelle und deren ausdrücklich erwarteter technischer Identität. Der begrenzte Adapter nutzt ausschließlich instanzgebundene Schnittstellen-/DeepL-Konfiguration, keine Organisationsinhalte oder Katalogbestände; er wählt deshalb keine Organisation oder Seed-Organisation aus. `organization_mainserver_credentials.technical_account_id` gehört zum ausgehenden Studio→Main-Server-Zugang und ist ausdrücklich **nicht** mit dem eingehenden Service-Subject gleichzusetzen. Kein neuer Account oder zweite fachliche Zuordnung. Aktive Instanz, Modul-/Lifecyclegeneration sowie aktuelle Sprache und Zugangsversion werden vor Anbieterarbeit und Antwort geprüft. Organisationsgebundene Inhaltsprüfung und Ergebnisspeicherung bleiben beim Main-Server; weitergehende organisationsgebundene Studio-Funktionen sind nicht Bestandteil dieses Endpunkts. Die reale Eignung der vorhandenen Serviceidentität/Audience muss vor Live-Nutzung nachgewiesen werden.

Der direkte `POST /api/v1/app-translations/translate` verarbeitet nur `news-v1`, Deutsch→Englisch, begrenzte vollständige Textgruppen. Keine Studio-Persistenz dynamischer Texte, keine zweite Queue; Main-Server besitzt Auftrag und Retry. Bestehende Plattform-/Modul- und redaktionelle Berechtigungen bleiben unverändert. URL-Speichern erhält die technischen Identitätsmetadaten.

## Folgen und Nachweise

Kein Token, Original- oder Ergebnistext wird durch diesen Handler geloggt. HTML muss dem vorhandenen Rich-Text-Schutzprofil entsprechen; unveränderte Tag-/Attributfolge und vollständige Ergebnisgruppe sind Voraussetzung. Unbekannter Abschluss kann bei Main-Server-Retry erneut DeepL-Kosten verursachen, kein Exactly-once. Die fünfsekündige App-Anzeigegrenze ist unabhängig vom begrenzten Studio-/Provideraufruf.

Gezielte Handler-/Settings-/Routingtests sichern Identitäts-/Mandantenablehnung, Metadatenerhalt, vollständige Antworten und Strukturprüfung. Ein realer Main-Server-/Studio-/DeepL-Aufruf und konkrete Audience-/Subjectevidenz bleiben gesonderte Abnahme. Siehe [Planungs- und Dienstvertrag](../../openspec/changes/add-central-app-translations/design.md).
