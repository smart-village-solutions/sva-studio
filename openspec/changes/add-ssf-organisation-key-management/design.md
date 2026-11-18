## Kontext und verbindliche Grenzen

Der untersuchte Ausgangsstand ist der saubere SSF-Studio-Checkout
`studio-key-convenience`, Branch `feat/recording-key-convenience`, Commit
`4b0e55d45`. Er enthält die neue SSF-Seitennavigation und die optionale
Passphrase-Dateirichtlinie. Der ältere Checkout `studio-recording` und der
anders zugeschnittene Hauptbranch sind keine Implementierungsbasis.

Das Gateway ist alleinige Quelle für öffentliche Organisationsschlüssel,
Versionen, Aktivierung, verschlüsselte Inhaltsschlüssel und Zugangsbelege.
Studio zeigt diese Daten an und verändert sie ausschließlich über den
authentisierten Gateway-Vertrag. Eine öffentliche Schlüsselversion wird nicht
zusätzlich in `content-v2` gespeichert. Die Aufzeichnungsrichtlinie bleibt eine
Studio-Konfiguration; konfigurierte Aktivierung und tatsächliche
Gateway-Schlüsselbereitschaft werden getrennt dargestellt.

Die SSF-Oberfläche bleibt für Gespräche und das Lesen von Aufzeichnungen
zuständig. Prüfende dürfen weiterhin gewöhnliche Gespräche führen. Die
persönliche Passphrase entsperrt weiterhin den bestehenden verschlüsselten
privaten Schlüsselblob; ihr Dateiformat wird hier nicht geändert.

## Seiten und Berechtigungen

- `/plugins/ssf/organisation-keys`: Zustand und öffentliche Versionshistorie,
  Ersteinrichtung und Ersatz. Verwaltung verwendet die vorhandene Berechtigung
  `ssf.configuration.tenant.manage` und bei Mutationen frische Gateway-MFA.
- `/plugins/ssf/access-transfers`: Quellperson, verfügbare Aufzeichnungen,
  Zielperson, Begründung, lokale Organisationsschlüsseldatei, Umfangsbestätigung
  und Ergebnis. Jede Datenabfrage und Mutation benötigt
  `ssf.recording.access.transfer`; sensible Schritte verlangen frische MFA.
- `descriptor.ts` registriert Actions, Routen, Serverhandler und Navigation.
  Die neue Transferberechtigung wird aus automatischen `system_admin`-
  Vollberechtigungen ausgeschlossen und bewusst über bestehendes IAM vergeben.
  Sie ist mandantengebunden und vermittelt allein keinen entschlüsselten Inhalt.
  Öffentliche Organisationsversionen dürfen für die Transferseite auch mit
  dieser expliziten Transferberechtigung gelesen werden; Aktivierung und Ersatz
  bleiben der Konfigurationsverwaltung vorbehalten.
- Vorhandene Studio-Seitentemplates, Formularfelder, Leave-Guard, Lade-/Fehler-
  zustände und DE/EN-Übersetzungen verwenden. Keine parallelen Basis-Komponenten.

## Authentisierte Ausführung

Browseraufrufe verwenden bestehende Studio-Session- und CSRF-Mechanismen.
Ein schmaler, nur serverseitiger Host-Zugriff löst `context.sessionId` auf die
bereits authentisierte Sitzung auf und verwendet `Session.accessToken` aus
`packages/auth-runtime`. Das SDK übermittelt keine Tokens in Browserkontext,
SSR-Daten oder frei nutzbare Plugin-Konfiguration.

Der Host tauscht dieses Benutzer-Token gemäß RFC 8693 am Token-Endpunkt des
konfigurierten Mandanten-Issuers mit dem vertraulichen Studio-Client aus:

```text
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
subject_token=<serverseitiges Benutzer-Access-Token>
subject_token_type=urn:ietf:params:oauth:token-type:access_token
requested_token_type=urn:ietf:params:oauth:token-type:access_token
audience=<konfiguriertes Gateway KEYCLOAK_AUDIENCE>
```

Die bestehende Client-Provisionierung erhält die explizite Exchange-Freigabe
und die erforderlichen Audience-/Claim-Mapper. Der Zielwert ist die bestehende
Gateway-Audience (aktuell standardmäßig `ssf-frontend`), keine neue implizite
Audience. Die resultierende Identität erhält ursprüngliches `sub`, passenden
Mandanten-Issuer und `studio_tenant_id`, aktuelle `ssf_permissions` sowie das
ursprüngliche `acr`/`auth_time`. Ein Austausch erneuert keine MFA. Bei fehlender
oder abgelaufener MFA führt Studio die vorhandene frische Reauthentisierung aus
und beginnt anschließend eine neue Vorbereitung mit aktueller Identität.

Keycloaks Standard-Token-Exchange V2 funktioniert nur innerhalb desselben
Realms. Die Studio-Benutzersitzung, der vertrauliche anfragende Studio-Client
und der Gateway-Zielclient müssen deshalb im selben SSF-Mandanten-Realm liegen;
der Requester benötigt den aktivierten Standard-Exchange und bereits erlaubte
Ziel-Audience-/Client-Scopes. Eine Audience-Einschränkung erzeugt keine zuvor
fehlenden Scopes. Stammt die vorhandene Studio-Sitzung aus einem anderen Realm,
gehört die tenantlokale Studio-Client-Provisionierung samt erneuter Anmeldung
zum Lieferumfang, bevor diese Seiten aktiviert werden. Cross-Realm-Token
Exchange und eine implizite Übertragung gleichnamiger Nutzer sind ausgeschlossen.
Diese Grenze ist durch einen echten Keycloak-Integrationstest nachzuweisen.
Grundlagen: [Keycloak Standard Token Exchange](https://www.keycloak.org/securing-apps/token-exchange)
und [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html).

Das Gateway prüft das ausgetauschte Token mit seiner bestehenden
`require_ssf_user`-Authentisierung und erzwingt Berechtigungen und MFA selbst.
Studio sendet keine selbst behaupteten Actor-/Permission-Header; insbesondere
verwendet es nicht die Client-Credentials-Identität des bestehenden
Session-Revocation-Clients als Benutzerersatz. Token-Endpunkt und Gateway-Ziel
kommen nur aus validierter Serverkonfiguration, niemals aus Browserparametern.
Fehlt Exchange-Unterstützung oder eine notwendige Policy, bleibt die Funktion
mit erklärbarem Verfügbarkeitsfehler geschlossen. Exchange-Adapter und Policy-
Provisionierung sind Lieferumfang, keine nachgelagerte offene Aufgabe.

## Gemeinsamer Gateway-Vertrag

Basis: `/api/admin/recording/v2`. Binärwerte sind Base64url; alle Antworten und
Fehler entsprechen dem SSF-Lifecycle-Vorschlag. Die folgenden Pfade sind neue
Verträge, keine Behauptung vorhandener Endpunkte.

| Aufruf | Eingabe / Ergebnis |
| --- | --- |
| `GET /organisation-keys` | Aktive und historische öffentliche Schlüsselmetadaten einschließlich ID, Version und Fingerabdruck. |
| `POST /organisation-keys/preparations` | `{publicKey, expectedActiveKeyId}` → `{preparationId, keyId, version, fingerprint, expiresAt, challengeEnvelope}`. |
| `POST /organisation-keys/preparations/{id}/activate` | `{proof, savedConfirmation: true}` → verbindliche aktive Metadaten. |
| `DELETE /organisation-keys/preparations/{id}` | Unverbindliche Vorbereitung abbrechen; aktive Version unverändert. |
| `GET /access-transfer/candidates?employeeSub=&cursor=` | Berechtigte, paginierte Metadaten ohne Klarnamen/Sprachen aus verschlüsselten Gesprächsinhalten. |
| `POST /access-transfer/preparations` | `{conversationIds, organisationKeyId, targetUserSub, expectedTargetKeyVersion, expectedTargetFingerprint, reason}` → `{transferId, scopeDigest, expiresAt, organisationKey, targetKey, challengeEnvelope, keys}`. |
| `POST /access-transfer/preparations/{id}/commit` | `{proof, wraps: [{conversationId, keyId, envelope}]}` → atomarer Zugangsbeleg. |

Jeder Eintrag in `keys` enthält `{conversationId, keyId, epoch, sourceWrap,
sourceSigner}`. Eine Vorbereitung umfasst genau eine Organisationsschlüssel-
version. Bei gemischten historischen Versionen teilt Studio den Umfang in
sichtbare Gruppen und verlangt pro Gruppe Datei und Bestätigung; es behauptet
keinen atomaren Gesamtvorgang über mehrere Gruppen.

Die lokale Kryptografie übernimmt exakt die Formate, Domänentrennungen,
kanonische Transkriptkodierung und Testvektoren aus
`update-recording-key-lifecycle/design.md` im SSF-Repository. Studio erfindet
keine alternative ECIES-/Signaturkodierung. Der Besitznachweis entschlüsselt
eine vom Gateway zufällig erzeugte, an den Organisationsschlüssel verschlüsselte
Challenge und berechnet HMAC-SHA256 über das festgelegte Transkript. Beim
Transfer umfasst dieses Actor, Tenant, Schlüsselversion, Zielperson/-version,
Umfang und Digests aller eingereichten neuen Envelopes. Der Nonce wird nicht
im Klartext geliefert; das Gateway prüft den Nachweis und signiert die
resultierenden Nutzer-Wraps. Ein reiner Dateiname oder Browser-Boolean ist kein
Schlüsselbesitznachweis. Der HMAC bindet Besitz und das eingereichte Transkript;
er beweist dem Gateway nicht, dass alte und neue Wraps denselben Klartext-
Inhaltsschlüssel enthalten. Die korrekte lokale Transformation wird durch
gemeinsame Python-/TypeScript-Known-Answer-Vektoren geprüft.

## Lokale Organisationsschlüssel

P-256-ECDH wird über Browser WebCrypto erzeugt. Die UTF-8-JSON-Datei lautet exakt
`{format:"ssf-organisation-key",formatVersion:1,tenantId,keyId,version,publicKey,fingerprint,privateKeyPkcs8}`.
PKCS#8 und der unkomprimierte 65-Byte-SEC1-Public-Key verwenden Base64url.
Importe sind auf 64 KiB begrenzt, verwenden ein striktes Schema und prüfen
P-256-Private/Public-Konsistenz, Tenant, ID, Version und Fingerabdruck.
Persönliche Passphrase-TXT-Dateien werden abgewiesen. Die unverschlüsselte
Organisationsdatei ist ein privates Geheimnis, keine
persönliche Passphrase-Datei. Download und Druckansicht erläutern sichere
organisatorische Verwahrung; optionale zusätzliche Dateiverschlüsselung wird
nicht als weiterer Workflow eingeführt.

Die Vorbereitung reserviert Metadaten, aktiviert aber keinen Schlüssel.
Studio erzeugt das Dateiartefakt mit diesen Metadaten und bietet Download und
Druck an. Erst die ausdrückliche Sicherungsbestätigung plus Challenge-Nachweis
aktiviert die Version. Ein abgebrochener/abgelaufener Vorgang lässt den aktiven
Schlüssel unverändert; nach einem unsicheren Netzwerkresultat liest Studio den
Gateway-Status, bevor es einen neuen Ersatz beginnt. Bei Ersatz bleiben
bisherige Versionen und ihre Aufzeichnungsbezüge erhalten.

Vorbereitungen laufen nach fünf Minuten ab. Identische erfolgreiche
Aktivierungs-/Transferwiederholungen liefern nach erneuter Autorisierung das
gespeicherte Operationsergebnis; abweichende Wiederholungen erhalten
`PREPARATION_USED`. Eine Wiederholung aktiviert keinen inzwischen ersetzten
Schlüssel erneut. Nach ungewissem Ergebnis liest Studio zusätzlich den aktuellen
Zustand, statt die historische Antwort als aktuellen Zustand auszugeben.
Nach fünf ungültigen Besitznachweisen verwirft das Gateway die Vorbereitung;
Studio verlangt einen neuen Vorgang statt unbegrenzt erneut zu senden.

Private Organisationsschlüssel und lokale rohe Inhaltsschlüssel verbleiben
im Arbeitsspeicher des Tabs. Die Challenge wird vom Gateway erzeugt und dort
für die kurze Vorbereitungslaufzeit ausschließlich verschlüsselt als
Verifier-Zustand aufbewahrt; die entschlüsselte Browserkopie bleibt im Tab und
wird niemals als Klartext zurückgesendet. Weder Schlüssel noch entschlüsselte
Challenge erscheinen in URLs, Browserpersistenz, SSR, Telemetrie, Logs oder
HTTP-Anfragen. Explizites Abbrechen, Kontextwechsel,
Logout und Seitenwechsel entfernen Referenzen und Druckansichten; nach Reload
wird erneut eine Datei benötigt. WebCrypto-Handles und JS-Speicher erlauben
keine Zusicherung vollständiger physischer Speicherlöschung.

## Zugangsübertragung und Fehler

Studio lädt nur Metadaten und geschützte Schlüsselumschläge. Namen stammen aus
dem autorisierten Benutzerverzeichnis; verschlüsselte Gesprächssprachen oder
Inhalte werden nicht zur Listenanreicherung entschlüsselt. Nach lokaler Prüfung
von Tenant, Version, Fingerabdruck und öffentlichem Schlüssel öffnet Studio die
ausgewählten Inhaltsschlüssel und schützt sie für die geprüfte Zielversion.
Die Bestätigung nennt Quellperson, exakte Aufzeichnungen, Zielperson, Vergleichs-
code/-version und Begründung. Änderungen daran verwerfen die Vorbereitung.

Das Gateway prüft bei Commit aktuellen Actor und Berechtigung, MFA, Ablauf,
Quelle, Zielversion, Sperr-/Löschzustand und exakte Schlüsselabdeckung erneut.
Ein Konflikt verändert keine Zugänge. Studio unterscheidet fehlende Rechte,
notwendige Reauthentisierung, falsche lokale Datei, abgelaufene Vorbereitung,
geänderten Zielschlüssel, geänderte aktive Organisationsversion, nicht mehr
verfügbare Aufzeichnung und vorübergehend ausgefallenes Gateway anhand stabiler
Lifecycle-Fehlercodes. Nach Konflikten muss Umfang/Empfänger erneut bestätigt
werden; ein automatischer Retry darf nie still einen anderen Schlüssel wählen.
Die stabilen Codes sind `PERMISSION_REQUIRED`, `STEP_UP_REQUIRED`,
`PREPARATION_NOT_FOUND`, `KEY_VERSION_CHANGED`, `SCOPE_CHANGED`,
`PREPARATION_USED`, `PREPARATION_EXPIRED`, `INVALID_KEY`, `INVALID_PROOF`,
`TRANSFER_SCOPE_TOO_LARGE` und `RECORDING_UNAVAILABLE`. Auswahlgrenzen sind
1–100 verschiedene Aufzeichnungen und höchstens 1000 Inhaltsschlüssel,
Begründungen 1–1000 Zeichen und Kandidatenseiten höchstens 50 Einträge.

## Dateizuschnitt und Arbeitsgrenzen

| Bereich | Zuständige Pfade |
| --- | --- |
| Routen/Actions/i18n | `plugin-ssf/src/descriptor.ts`, `constants.ts`, `admin.tenant-page.tsx`, `plugin.translations.de.ts`, `plugin.translations.en.ts` |
| Lokale Abläufe | Kleine `admin.organisation-keys.*`- und `admin.access-transfers.*`-Module unter `plugin-ssf/src`, geteilter lokaler Crypto-/Dateicode nur für diese Verbraucher |
| Gateway-Verträge/Client | `plugin-ssf/src/organisation-key-contracts.ts`, `organisation-key-client.ts`, `server/organisation-keys.ts`, Registrierung in bestehendem Server-Einstieg |
| Benutzer-Token Exchange | `auth-runtime/src` neben bestehendem Session-/Plugin-Host, schmale Capability im `plugin-sdk`; bestehende Keycloak-Client-Anforderungen/-Provisionierung erweitern |
| Nachweise | Fokussierte `plugin-ssf/tests`, `auth-runtime`-Exchange-/Host-Tests und konkrete Keycloak-/Gateway-Vertragstests |

Die neue Dateigruppe liefert die unmittelbar fehlenden Plugin-Abläufe und
vermeidet Änderungen an SSF-Gesprächs-/Prüfungscode. Bestehende Konfigurations-
editoren werden nur für wahrheitsgemäße Verlinkung und Readiness-Hinweise
angepasst; unbekannte Content-Felder und Passphrase-Dateirichtlinien bleiben
erhalten. Es entstehen keine neuen Studio-Tabellen für Schlüsselmaterial.

## Kritische Invarianten und Nachweise

| Invariante | Geplanter Nachweis |
| --- | --- |
| Private Organisations- und rohe Inhaltsschlüssel verlassen den Browser nicht. | HTTP-/SSR-/Logging-Assertions mit eindeutigen geheimen Testmarkern; Download-/Print-Tests; Reload-/Kontextwechseltests. |
| Jeder Gateway-Aufruf ist der echten Benutzeridentität und dem Tenant zugeordnet. | Exchange-/JWT-Integration mit falscher Audience, falschem Tenant, Service-Token, geändertem `sub`, alter MFA und verweigerter Exchange-Policy. |
| Übertragung entspricht bestätigtem Umfang und Zielschlüssel. | Gemeinsame Python-/Browser-Testvektoren, manipulierte Wraps/Proofs, fehlende/zusätzliche Schlüssel, Zielrotation zwischen Vorbereitung und Commit. |
| Abbruch und Versionskonflikt ändern keine aktive Version/Zugänge. | UI-/Gateway-Vertragstests für parallelen Ersatz, Ablauf, Netzwerkverlust und erneute Statusabfrage. |
| Reine Administration erhält keinen Transferzugriff. | Action-/Handler-/Direktroutentests einschließlich automatischer Rollenberechtigung und expliziter Vergabe. |

## Umstellung und Bereitstellung

Die Nutzerentscheidung erlaubt einen sauberen neuen Testdatenstand ohne
Migration des alten Schwellenwert-Recovery. Dieser Vorschlag führt selbst
keine Bereinigung aus. Umsetzung und Abschaltung des alten Gateway-Verfahrens
werden mit dem SSF-Lifecycle-Change abgestimmt; es entsteht kein dauerhafter
zweiter Recovery-Pfad. Neue Seiten erst bereitstellen, wenn Gateway-Vertrag,
Exchange-Provisionierung und Integrationsnachweise gemeinsam vorhanden sind.
Der bestehende kanonische Studio-Rollout bleibt maßgeblich. Bei Rollback keine
aktive Schlüsselversion oder bestehende Zugänge automatisch zurücksetzen.
