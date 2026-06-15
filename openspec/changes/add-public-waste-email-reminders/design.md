## Kontext
Die öffentliche Waste-Web-App löst bereits den Standort auf und zeigt einen adressbezogenen Kalender ohne Login. Parallel existiert an Abfallfraktionen bereits eine kanalbezogene Reminder-Konfiguration mit E-Mail-Freigabe und Slot-Modell. Für den neuen Dienst muss diese vorhandene Fachlogik in einen öffentlichen, datenschutzkonformen Self-Service-Fluss überführt werden.

## Entscheidung
Der E-Mail-Erinnerungsdienst wird fachlich vollständig in der öffentlichen Abfallkalender-Web-App und im Waste-Modul verankert. Formular, Double-Opt-In-Bestätigung, Aktivierungsbestätigung und Abmeldung laufen auf Unterseiten derselben App. Die Aktivierung erfolgt erst nach bestätigtem Double-Opt-In; vorher bleibt das Abo in einem Pending-Zustand. Der technische Versand selbst wird jedoch nicht im Waste-Modul konfiguriert, sondern über eine zentrale Mail-Transport-Schnittstelle aus `interfaces` bereitgestellt.

## Formular- und Slot-Modell
Der Nutzer wählt zunächst eine E-Mail-Adresse und danach eine oder mehrere Abfallarten. Angeboten werden nur Fraktionen, deren `reminderConfig.channels.email` aktiv ist und die mindestens einen gültigen E-Mail-Slot besitzen. Für jede gewählte Abfallart wird die Slot-Auswahl separat erfasst, weil verschiedene Fraktionen unterschiedliche Zeitfenster verwenden dürfen. Treffen mehrere gewählte Fraktionen am selben Abholtag zusammen, versendet das System mehrere E-Mails statt einer Sammelmail.

## Persistenzmodell
Der Dienst benötigt eine eigene Persistenz für:
- Subscription-Kopf mit Standortkontext, E-Mail-Adresse, Status und Zustimmungsnachweis
- Subscription-Items pro Fraktion und gewähltem Slot
- Token-Verwaltung für DOI und Abmeldung
- Versandaufträge oder Outbox-Ereignisse für die Übergabe an die Mail-App
- Versand- oder Deduplizierungsnachweise pro `subscription + fraction + slot + pickup-date`

Tokens werden nur gehasht persistiert. Pending-Abos erhalten eine TTL und werden bereinigt, wenn der Double-Opt-In nicht bestätigt wird.

Die Outbox bildet die Hot-Path-Persistenz für fällige Sendungen. Sie speichert nur normalisierte Versandaufträge mit geplantem Versandzeitpunkt, Dedupe-Key, Template-Referenz und minimalem Payload. Volle Mail-Bodies werden nicht vorab materialisiert.

## Laufzeitmodell
Die öffentliche App erhält Server-Endpunkte für:
- Formularabsendung
- DOI-Bestätigung
- Abmeldung
- optional Status-/Textauflösung für die zugehörigen Bestätigungsseiten

Ein Waste-seitiger Materialisierungsprozess ermittelt fällige Erinnerungen aus aktiven Abos und den bestehenden Waste-Terminen. Er prüft pro Fraktion und Slot, ob ein Versandauftrag fällig ist, und erzeugt dafür einen normalisierten Auftrag oder ein Outbox-Ereignis. Eine zentrale Mail-Transport-Schnittstelle aus `interfaces` konsumiert oder bedient diese Aufträge und übernimmt Zustellung, Retry, Backoff und Provider-Anbindung. Deduplizierung und Idempotenz müssen verhindern, dass derselbe Reminder mehrfach materialisiert oder mehrfach versendet wird.

Die Materialisierung soll inkrementell statt als Vollscan arbeiten. Fachlich sinnvolle Trigger sind insbesondere:
- Aktivierung eines Abos per DOI
- Änderung oder Import von Waste-Terminen
- Änderung fraktionsbezogener Reminder-Slots
- begrenzte Vorlauf-Läufe für einen kleinen zukünftigen Zeitraum

Die angebundene Mail-Transport-Laufzeit verarbeitet nur fällige Outbox-Einträge in kleinen Batches. Dadurch werden DB-Last, Join-Kosten und Provider-Spitzen reduziert.

## Output-Modell im Waste-Management
Die fraktionsbezogene Reminder-Konfiguration bleibt fachlich führend für verfügbare E-Mail-Kanäle und Zeitfenster. Zusätzlich erhält das Waste-Management im bestehenden Tab `output` eine globale Card `E-Mail-Erinnerungsdienst` für:
- globalen Aktiv-Switch
- Public-Base-URL und Pfade für DOI/Abmeldung/Erfolg
- Absenderdaten und Reply-To
- Datenschutz- und Impressumslinks
- Textbausteine für DOI, Reminder, Aktivierungsseite und Abmeldeseite
- technische Leitplanken wie Token-TTL, Rate-Limits und maximale Pending-Lebensdauer

Die Zuständigkeit innerhalb des Studios bleibt klar: Der Dienst ist fachlich Teil des Waste-Bereichs. Deshalb werden Konfiguration, Pflege und spätere Betriebsansichten nicht in generische Studio- oder plattformweite E-Mail-Settings ausgelagert, sondern ausschließlich im Modul `waste-management` verankert. Innerhalb des Moduls liegt die Pflege bewusst im Tab `output`, weil der Dienst ein Ausgabekanal des öffentlichen Abfallkalenders ist.

SMTP- oder Provider-Credentials gehören nicht in diese Card. Die Card im Tab `output` pflegt nur fachlich sichtbare Absenderdaten und Waste-spezifische Kommunikationsparameter. Technische Transportdaten werden ausschließlich in einer zentralen Mail-Transport-Konfiguration unter `interfaces` verwaltet.

### Detailzuschnitt der Card `E-Mail-Erinnerungsdienst`
Die Card soll in klar getrennte Abschnitte gegliedert werden, damit fachliche Redakteure, Waste-Verantwortliche und technische Betreiber nicht in einem unstrukturierten Formular arbeiten.

#### 1. Abschnitt `Aktivierung`
Zweck:
- globales Ein- und Ausschalten des Dienstes pro Waste-Instanz
- bewusste Steuerung, ob die öffentliche App den Einstieg überhaupt anbietet

Felder:
- `enabled`: Boolean, aktiviert oder deaktiviert den gesamten E-Mail-Erinnerungsdienst
- `publicSignupEnabled`: Boolean, optional getrennte Freigabe des öffentlichen Einrichtungsflusses
- `transportId`: Referenz auf die zentrale Mail-Transport-Schnittstelle aus `interfaces`

Validierungen:
- Aktivierung nur zulässig, wenn ein gültiger `transportId` referenziert wird
- Aktivierung nur zulässig, wenn Public-Base-URL, DOI-/Abmeldepfade und Datenschutzlink gesetzt sind
- Bei deaktiviertem Dienst darf der öffentliche CTA nicht gerendert werden

UI-Hinweise:
- oberhalb des Schalters kurzer Statushinweis, ob der Dienst produktiv nutzbar ist
- Health-Status des referenzierten Mail-Transports read-only anzeigen

#### 2. Abschnitt `Öffentliche URLs`
Zweck:
- konsistente Links für DOI, Abmeldung und Erfolgsseiten
- keine hartcodierten Domain- oder Pfadangaben in Templates

Felder:
- `publicBaseUrl`: z. B. `https://bb-prignitz.abfallkalender.smart-village.app`
- `doiConfirmPath`: relativer Pfad oder kanonischer Zielpfad für DOI-Bestätigung
- `unsubscribePath`: relativer Pfad oder kanonischer Zielpfad für Abmeldung
- `signupSuccessPath`: optionaler Pfad für Rücksprung nach Pending-Formularabschluss
- `activationSuccessPath`: optionaler Pfad für erfolgreiche DOI-Aktivierung
- `unsubscribeSuccessPath`: optionaler Pfad für erfolgreiche Abmeldung
- `invalidTokenPath`: optionaler Pfad für ungültige oder abgelaufene Token

Validierungen:
- `publicBaseUrl` muss absolute HTTPS-URL sein, lokal in Dev auch `http://*.localhost` zulässig
- Pfade müssen mit `/` beginnen und dürfen keine Fremd-Domain enthalten
- DOI- und Abmeldepfad sind Pflichtfelder

Ableitungen:
- finale Links in Mails werden immer aus `publicBaseUrl + configuredPath + token/query` zusammengesetzt

#### 3. Abschnitt `Absender`
Zweck:
- fachlich sichtbare Kommunikationsidentität des Waste-Dienstes
- klare Trennung zwischen sichtbarem Absender und technischem SMTP-Transport

Felder:
- `fromName`: sichtbarer Absendername, z. B. `Landkreis Prignitz Abfallwirtschaft`
- `fromEmail`: sichtbare Absenderadresse
- `replyToEmail`: optionale Antwortadresse
- `serviceLabel`: optionale Kurzbezeichnung des Dienstes, z. B. `Mülli`

Validierungen:
- `fromEmail` muss RFC-kompatibles E-Mail-Format erfüllen
- `replyToEmail` optional, falls gesetzt ebenfalls gültiges E-Mail-Format
- bei gesetztem `transportId` kann optional geprüft werden, ob `fromEmail` zum Transport passt oder von diesem zugelassen ist

Hinweis:
- technische Defaults aus `interfaces` können vorausgefüllt werden, die Waste-Card bleibt aber fachlich überschreibbar, soweit der Transport dies zulässt

#### 4. Abschnitt `Recht und Einwilligung`
Zweck:
- alle rechtsrelevanten Referenzen und der Einwilligungstext werden zentral gepflegt
- Formular und Mails verwenden kurze, verlinkte Hinweise statt unstrukturierter Langtexte

Felder:
- `privacyPolicyUrl`: Pflichtlink zur Datenschutzerklärung
- `imprintUrl`: Pflichtlink zum Impressum
- `consentLabel`: Pflichttext der Formular-Checkbox
- `consentVersion`: technische Versionskennung des Einwilligungstexts
- `dataControllerLabel`: optionale Bezeichnung des Verantwortlichen
- `dataProtectionContactEmail`: optionale Datenschutz-Kontaktadresse

Validierungen:
- `consentLabel` darf nicht leer sein
- `consentVersion` ist Pflicht, sobald der Dienst aktiviert wird
- URLs müssen absolute HTTP(S)-Links sein

Persistenzfolge:
- bei Formularabsendung werden `consentVersion`, Zeitstempel und Standortkontext am Pending-Abo gespeichert

#### 5. Abschnitt `DOI-Kommunikation`
Zweck:
- Pflege aller Texte für die Double-Opt-In-Mail und zugehörige Statusseiten

Felder:
- `doiSubjectTemplate`
- `doiPreheader`
- `doiIntroText`
- `doiButtonLabel`
- `doiFallbackText`
- `doiExpiryNoticeText`
- `doiSuccessHeadline`
- `doiSuccessBody`
- `doiErrorHeadline`
- `doiErrorBody`

Template-Regeln:
- erlaubt sind nur freigegebene Platzhalter wie `{{calendarName}}`, `{{locationLabel}}`, `{{confirmUrl}}`
- keine freien HTML-Blöcke; stattdessen Markdown oder Plaintext mit begrenztem Rendering

Validierungen:
- Betreff, Einleitung und Button-Label sind Pflicht
- unbekannte Platzhalter werden serverseitig abgewiesen

#### 6. Abschnitt `Reminder-Kommunikation`
Zweck:
- fachliche Textbausteine für die eigentlichen Erinnerungs-E-Mails

Felder:
- `reminderSubjectTemplate`
- `reminderIntroTemplate`
- `reminderListIntroTemplate`
- `reminderOutroText`
- `unsubscribeLinkLabel`
- `reminderReasonText`

Template-Regeln:
- erlaubte Platzhalter mindestens `{{pickupDate}}`, `{{fractionName}}`, `{{locationLabel}}`, `{{unsubscribeUrl}}`
- da pro Fraktion und Slot einzeln versendet wird, muss der Standardfall eine Einzel-Fraktion sauber abbilden

Validierungen:
- Betreff, Intro und Abmeldelink-Label sind Pflicht
- `unsubscribeUrl` muss immer technisch durch das System ergänzt werden, nie manuell als statischer Link

#### 7. Abschnitt `Abmeldeseite`
Zweck:
- Texte für die öffentliche Bestätigungsseite nach erfolgreicher oder redundanter Abmeldung

Felder:
- `unsubscribeSuccessHeadline`
- `unsubscribeSuccessBody`
- `unsubscribeAlreadyDoneHeadline`
- `unsubscribeAlreadyDoneBody`
- `unsubscribeErrorHeadline`
- `unsubscribeErrorBody`

Validierungen:
- Success-Headline und Success-Body sind Pflicht
- Already-done- und Error-Texte empfohlen, aber optional mit sinnvollen Defaults

#### 8. Abschnitt `Technische Leitplanken`
Zweck:
- fachnahe Anti-Abuse- und Lebensdauerregeln direkt dort pflegbar machen, wo der Dienst betrieben wird

Felder:
- `doiTokenTtlHours`
- `pendingSubscriptionTtlHours`
- `maxSubscriptionsPerEmailAndLocation`
- `signupRateLimitPerIpPerHour`
- `signupRateLimitPerEmailPerHour`
- `materializationLookaheadDays`
- `unsubscribeTokenTtlDays`, falls Tokens rotierbar oder zeitlich begrenzt sein sollen

Validierungen:
- TTL-Felder müssen positive Ganzzahlen sein
- Lookahead darf nur in einem begrenzten Intervall liegen, z. B. `1..14`
- Limits dürfen nicht `0` sein, außer `0` ist explizit als `deaktiviert` spezifiziert

#### 9. Abschnitt `Vorschau und Diagnose`
Zweck:
- sichere Redaktionshilfe ohne produktiven Versand
- schnelle Sichtprüfung der konfigurierten Texte und Links

Felder und Funktionen:
- read-only Anzeige des referenzierten `transportId`
- read-only Anzeige `healthStatus` und `lastHealthCheckAt` aus `interfaces`
- Template-Vorschau für DOI-Mail
- Template-Vorschau für Reminder-Mail mit Beispieldaten
- optional Testversand nur an intern freigegebene Adressen, falls das Studio dafür bereits ein Muster besitzt

Beschränkung:
- kein vollwertiges Provider-Debugging im Waste-Modul
- keine Secret-Anzeige

### Empfohlene UI-Struktur innerhalb der Card
Damit die Card trotz ihres Umfangs bedienbar bleibt, sollte sie intern nicht als unendliches Formular erscheinen. Empfohlen ist:
- vertikale Abschnittsgruppen mit klaren Überschriften
- initial sichtbar: `Aktivierung`, `Öffentliche URLs`, `Absender`
- einklappbar oder sekundär: `DOI-Kommunikation`, `Reminder-Kommunikation`, `Abmeldeseite`, `Technische Leitplanken`, `Vorschau und Diagnose`

Alternative:
- Tabs innerhalb der Card für `Allgemein`, `Texte`, `Recht`, `Technik`

Bevorzugt wird eine einzige Card mit internen Abschnittsgruppen, damit der bestehende `output`-Tab nicht um weitere Hauptebenen anwächst.

## Interfaces-Modell
Die technische Mail-Anbindung wird als zentrale Schnittstelle modelliert. Dort werden SMTP- oder Provider-Parameter, Secret-Referenzen, TLS-Einstellungen und gegebenenfalls Transportmodi gepflegt. Waste referenziert diesen Transport nur über einen stabilen Vertragsanker und hält selbst keine Credentials.

Empfohlene Felder der zentralen Mail-Transport-Schnittstelle:
- `transportId`: stabiler technischer Schlüssel der Transportkonfiguration
- `displayName`: sprechender Anzeigename der Anbindung im Studio
- `transportType`: z. B. `smtp`, später erweiterbar für API-basierte Provider
- `host`: SMTP-Host oder Provider-Endpunkt
- `port`: technischer Transport-Port
- `securityMode`: z. B. `none`, `starttls`, `tls`
- `authMode`: z. B. `basic`, `oauth2`, `none`
- `username`: technischer Loginname, falls erforderlich
- `secretRef`: Referenz auf das Secret für Passwort, Token oder API-Key
- `fromEmailDefault`: optionaler technischer Standard-Absender
- `fromNameDefault`: optionaler technischer Standard-Absendername
- `replyToDefault`: optionales technisches Reply-To-Default
- `rateLimitPerMinute`: optionales Provider- oder Betriebslimit
- `maxBatchSize`: maximale Anzahl auszuliefernder Mails pro Batch
- `active`: Aktivstatus der Transportanbindung
- `healthStatus`: letzter technischer Zustand der Anbindung
- `lastHealthCheckAt`: Zeitpunkt der letzten technischen Prüfung

Bewusst nicht Teil dieser Schnittstelle sind Waste-spezifische Texte, DOI-Links, Datenschutzhinweise oder fraktionsbezogene Reminder-Regeln. Diese bleiben im Modul `waste-management`.

## Sicherheits- und Datenschutzfolgen
Der Dienst verarbeitet personenbezogene Daten und muss deshalb Input-Validierung, Token-Härtung, Rate-Limits, TTLs, Logging ohne Klartext-PII und nachvollziehbare Zustimmungsnachweise bieten. DOI- und Abmeldelinks müssen idempotent sein. Die technische Nachvollziehbarkeit darf Versand- und Statusereignisse erfassen, aber keine Klartext-E-Mail-Adressen in Logs schreiben. Die Verlagerung des Transports in eine zentrale Interface-Konfiguration verschiebt Provider-Secrets, Retry-Strategien und Bounce-Verarbeitung aus dem Waste-Modul heraus, entbindet Waste aber nicht von fachlicher Nachvollziehbarkeit über erzeugte Versandaufträge.

## Auswirkungen
- Die Public-Waste-App erweitert ihren Bürgerfluss um einen neuen adressgebundenen Self-Service-Pfad.
- Waste-Management erhält erstmals globale Einstellungen und Textbausteine speziell für einen öffentlichen Kommunikationskanal.
- Das Waste-Datenmodell wächst um abonnentenbezogene Reminder-Persistenz sowie um den Vertrag zur Übergabe normalisierter Versandaufträge an eine zentrale Mail-Transport-Schnittstelle.
- Die Laufzeitarchitektur ergänzt eine ressourcenschonende Outbox-/Materialisierungsschicht zwischen Waste-Fachlogik und Mail-Transport.
