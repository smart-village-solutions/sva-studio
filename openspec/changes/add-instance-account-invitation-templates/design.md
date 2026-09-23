# Design: Vererbte Account-Einladung mit Keycloak-owned Versand

## Context

Der bestehende IAM-Pfad ruft für einen Account im zugeordneten Tenant-Realm
`execute-actions-email` mit `UPDATE_PASSWORD`, Login-Client und Callback auf.
Keycloak erzeugt den signierten, zeitlich begrenzten Aktionslink, rendert die
E-Mail und versendet sie. Die Admin-API gibt diesen Link nicht an das Studio
zurück.

Jede Studio-Instanz besitzt einen exklusiven `authRealm` und einen kanonischen
`primaryHostname`. Eine Studio-Installation benötigt zusätzlich einen
zentralen Standardtext, den Instanzen ohne eigenen Text erben. Keycloak bleibt
für Rendering, Aktionslink und Versand zuständig; deshalb wird der wirksame
Text unmittelbar vor dem konkreten Versand im betroffenen Realm sichergestellt.

## Goals / Non-Goals

### Goals

- einen deutschen Serverstandard und optional pro Instanz einen abweichenden
  Betreff und Nachrichtentext pflegen;
- den Keycloak-Aktionslink, seine Signatur und seine Ablaufsteuerung vollständig
  bei Keycloak belassen;
- Tenantname, Passwortlink, Startseite und Gültigkeitsdauer über kontrollierte
  Platzhalter einsetzen;
- Plaintext und HTML deterministisch aus derselben Studio-Vorlage erzeugen;
- die wirksame Vorlage vor jedem Versand für genau einen Realm idempotent
  sicherstellen;
- ohne Individualvorlage den Servertext und ohne Servervorlage einen
  versionierten SVA-Standardtext verwenden.

### Non-Goals

- Studio-eigener SMTP-Transport oder Action-Token-Erzeugung;
- beliebige E-Mail-Typen, Layout-Builder oder Marketing-Templates;
- sofortige Fleet-Projektion, Hintergrundjobs oder globale Teilfehlerzustände;
- tenantseitige Self-Service-Delegation;
- mehrere Sprachen je Instanz im ersten Lieferabschnitt.

## Decisions

### Eine einfache Vererbung bestimmt den gewünschten Text

Die Servervorlage und die optionale Individualvorlage verwenden dasselbe
typisierte, versionierte Objekt. Es enthält ausschließlich:

- `revision`
- `subject`
- `body`
- `passwordSetupLinkLabel`
- `tenantHomepageLinkLabel`

Die wirksame Vorlage wird ohne Kopie nach folgender Reihenfolge aufgelöst:

1. Individualvorlage der Instanz;
2. Servervorlage der Studio-Installation;
3. eingebauter SVA-Standard.

Eine Servervorlage wird als einzelner typisierter Datensatz mit stabilem
Schlüssel `account_invitation` und Revision gespeichert. Daraus entsteht weder
eine freie Template-Engine noch ein typunabhängiger Renderer. Weitere
Templatearten benötigen später jeweils einen eigenen Vertrag und Verbraucher.

Die Vorlage enthält weder Realmname noch Hostname als kopierte Werte.
`displayName` und die HTTPS-Startseiten-URL werden bei Vorschau und Versand aus
dem aktuellen Instanzdatensatz abgeleitet.

### Kontrollierte Textvorlage statt HTML-Editor

Betreff und Nachricht sind normale Textfelder. Zulässig sind ausschließlich:

- `{{tenantName}}`
- `{{passwordSetupLink}}`
- `{{tenantHomepageLink}}`
- `{{linkExpiresIn}}`

`{{passwordSetupLink}}` muss im Nachrichtentext genau einmal vorkommen.
`{{tenantHomepageLink}}`, `{{tenantName}}` und `{{linkExpiresIn}}` sind optional.
Unbekannte Platzhalter, HTML-Tags und URI-Schemata wie `http:`, `https:`,
`mailto:` oder `javascript:` in frei eingegebenem Text werden abgewiesen. Die
beiden Linkbeschriftungen dürfen keine Platzhalter oder Markup enthalten.

Der Server kompiliert die semantischen Platzhalter in die von Keycloak
erwarteten MessageFormat-Argumente:

- Passwortlink -> `{0}`
- Tenantname -> `{2}`
- Gültigkeitsdauer -> `{4}`
- Tenant-Startseite -> kanonische `https://<primaryHostname>/`-URL

MessageFormat-Sonderzeichen werden korrekt maskiert. Für Plaintext werden Links
als vollständige URLs ausgegeben. Für HTML wird sämtlicher Freitext escaped;
nur die beiden serverseitig erzeugten Links werden als sichere, beschriftete
Anchors eingesetzt. Es gibt keinen Pfad für gespeichertes oder durchgereichtes
Roh-HTML.

### Keycloak wird nur bedarfsgesteuert für den konkreten Versand ausgerichtet

`sva-kern2` erhält den Theme-Typ `email` und deutsche Standardwerte für
`executeActionsSubject`, `executeActionsBody` und `executeActionsBodyHtml`.
Neue Realms setzen neben dem Login-Theme auch `emailTheme = sva-kern2` über die
bereits vorhandene Realm-Baseline.

Das Speichern einer Server- oder Individualvorlage verändert keinen Realm.
Unmittelbar vor Create- oder Resend-Einladungen liest der vorhandene IAM-Pfad
die drei Realmwerte. Stimmen sie nicht mit der kompilierten wirksamen Vorlage
überein, setzt er `emailTheme = sva-kern2`, schreibt genau diese drei Schlüssel
und bestätigt sie durch Readback. Erst danach ruft er
`execute-actions-email` auf.

Ein fehlgeschlagener Write oder Readback ist ausschließlich ein Fehler dieses
konkreten Einladungsversands. Ein späterer Resend wiederholt dieselbe
idempotente Sicherstellung. Es gibt keinen Fleet-Job, keinen globalen
Projektionsstatus und keinen separaten Retry-Vertrag.

### Serverstandard und Instanzabweichung bleiben klar getrennt

Die neue Route `System -> Templates` zeigt zunächst ausschließlich die Karte
„Account-Einladung“. Sie verwendet wie die Instanzverwaltung die bestehende
Plattform-Autorisierung `instance.registry.manage`; eine neue Permission ist
nicht erforderlich. Die Seite ist kein generischer Editor und erzeugt keine
leeren Erweiterungspunkte für noch nicht vorhandene Vorlagentypen.

Die bestehende Instanzdetailseite behält die Aktion „Account-Einladung
anpassen“. Ohne Individualvorlage zeigt sie die geerbte Servervorlage samt
Quelle. „Auf Standard zurücksetzen“ entfernt nur den Instanz-Override und
bedeutet künftig „Servervorlage erben“.

Der Dialog zeigt:

- Betreff und Nachricht;
- die zwei Linkbeschriftungen;
- die erlaubten Platzhalter;
- eine Vorschau mit nicht produktiven Beispieldaten;
- die Quelle `Servervorlage`, `Instanzvorlage` oder `SVA-Standard`;
- „Speichern“ und die jeweils passende Rücksetzaktion.

Vorschauen dürfen niemals einen echten Keycloak-Aktionslink oder Empfänger-PII
anfordern oder darstellen. Erfolg und Fehler werden als zugängliche
Statusmeldung mit `role="status"` ausgegeben.

### Revisionsvertrag ohne verteilten Speicherprozess

Der Client sendet beim Speichern die zuletzt gelesene Server- oder
Instanzrevision. Eine abweichende Revision wird vor Persistenz als Konflikt
abgewiesen. Speichern und Zurücksetzen sind reine Studio-Datenbankoperationen;
sie führen keinen Keycloak-Write aus.

Das Zurücksetzen der Servervorlage entfernt den gespeicherten Server-Override
und aktiviert den eingebauten SVA-Standard. Das Zurücksetzen einer
Instanzvorlage entfernt ausschließlich den Instanz-Override. Realmwerte werden
beim nächsten Einladungsversand auf den dann wirksamen Text ausgerichtet.

### Einladung bleibt Keycloak-owned und wird erst nach exaktem Readback versendet

Der vorhandene Account-Erstellungs- und Resend-Pfad löst zuerst die wirksame
Vorlage auf und stellt sie wie beschrieben im Realm sicher. Bei einem nicht
bestätigten Write oder nicht lesbarem Realm wird keine Einladung mit
möglicherweise falschem Inhalt versendet.

Die Accountanlage bleibt dabei gemäß bestehendem Vertrag erfolgreich; nur der
Einladungsstatus wird als fehlgeschlagen gemeldet. Ein späterer Resend verwendet
denselben Pfad. Damit greift eine geänderte Servervorlage automatisch beim
nächsten Versand für jede Instanz ohne eigenen Text.

## Errors and recovery

| Zustand                                  | Verhalten                                                            |
| ---------------------------------------- | -------------------------------------------------------------------- |
| ungültiger oder unbekannter Platzhalter  | `invalid_request` vor Persistenz und Keycloak-Zugriff                |
| konkurrierende Revision                  | `conflict`, keine Mutation                                           |
| Realm gehört nicht eindeutig zur Instanz | fail-closed, keine Realm-Mutation                                    |
| Keycloak-Schreibfehler vor Versand       | keine E-Mail; ein späterer Resend versucht die Sicherstellung erneut |
| Readback weicht ab                       | keine E-Mail mit möglicherweise falschem Inhalt                      |
| Keycloak-E-Mail-Versand schlägt fehl     | Account bleibt angelegt, Einladung bleibt separat `failed`           |

## Security and privacy

- Aktionslink, Token und Ablaufprüfung verbleiben vollständig in Keycloak.
- Die Ziel-Startseite stammt ausschließlich aus `primaryHostname` der
  Instanz-Registry und verwendet HTTPS.
- Realm-Auflösung verwendet ausschließlich die exklusive
  `instanceId -> authRealm`-Zuordnung.
- Templateinhalte werden nicht in Logs, Fehlerdetails oder Telemetrie
  geschrieben. Audit enthält nur Actor, Instanz, Operation, Revision/Fingerprint
  und Ergebnis.
- Vorschau und Tests enthalten keine Empfängeradresse und keinen realen
  Aktionslink.
- Direkte Keycloak-Änderungen werden vor dem nächsten Versand durch den
  Studio-Sollzustand ersetzt oder blockieren diesen Versand.

## Test strategy

- reine Compiler-Tests für alle Platzhalter, Escaping, Plaintext und HTML;
- Negativtests für fehlenden/mehrfachen Passwortlink, unbekannte Tokens, Markup,
  freie URLs und Längenlimits;
- Repository- und Contract-Tests für Server-/Instanzrevision, Vererbung, Reset
  und Instanzscope;
- Keycloak-Adaptertests für exakt drei Lokalisierungsschlüssel und kausalen
  Readback;
- Fault-Tests für Write-/Readbackfehler und idempotente Sicherstellung;
- IAM-Tests, dass Create und Resend erst nach bestätigtem wirksamen Text senden,
  die Accountanlage bei Fehler aber erhalten bleibt;
- UI-Tests für Vererbungsquelle, Vorschau, Konflikt, Reset und barrierefreie
  Rückmeldungen;
- Theme-Paketprüfung sowie Testrealm-Abnahme mit tatsächlichem Mailversand und
  gültigem Passwort-Aktionslink.

## Migration and rollout

1. Additive Datenbankmigration und Theme-Erweiterung ausrollen.
2. Neue Realms erhalten das E-Mail-Theme automatisch über die Baseline.
3. Bestehende Realms bleiben unverändert, bis die nächste Einladung ihren
   wirksamen Text bedarfsgesteuert sicherstellt.
4. Die erste Umgebungsabnahme verwendet einen Testrealm und eine Testadresse.
5. Ein Rollback entfernt die Studio-UI und stoppt weitere bedarfsgesteuerte
   Aktualisierungen; bereits gesetzte Realm-Overrides werden nicht durch ein
   Downgrade blind gelöscht.

## Open questions

- Soll ein späterer Change die Pflege mit einer eigenen Permission an
  tenantlokale `system_admin`-Nutzer delegieren?
- Benötigen einzelne Instanzen künftig zusätzlich englische Vorlagen, obwohl
  die aktuelle New-Realm-Baseline ausschließlich Deutsch aktiviert?
