# Design: Instanzbezogene Account-Einladung mit Keycloak-owned Versand

## Context

Der bestehende IAM-Pfad ruft für einen Account im zugeordneten Tenant-Realm
`execute-actions-email` mit `UPDATE_PASSWORD`, Login-Client und Callback auf.
Keycloak erzeugt den signierten, zeitlich begrenzten Aktionslink, rendert die
E-Mail und versendet sie. Die Admin-API gibt diesen Link nicht an das Studio
zurück.

Jede Studio-Instanz besitzt einen exklusiven `authRealm` und einen kanonischen
`primaryHostname`. Damit kann die bestehende Instanzverwaltung eine
instanzbezogene Vorlage sicher in genau einen Realm projizieren und die
Startseiten-URL ohne freie Benutzereingabe ableiten.

## Goals / Non-Goals

### Goals

- pro Instanz einen eigenen deutschen Betreff und Nachrichtentext pflegen;
- den Keycloak-Aktionslink, seine Signatur und seine Ablaufsteuerung vollständig
  bei Keycloak belassen;
- Tenantname, Passwortlink, Startseite und Gültigkeitsdauer über kontrollierte
  Platzhalter einsetzen;
- Plaintext und HTML deterministisch aus derselben Studio-Vorlage erzeugen;
- Teilfehler und Drift zwischen gespeicherter Instanzkonfiguration und Realm
  sichtbar und vor einem weiteren Einladungsversand wirksam machen;
- ohne Individualvorlage einen versionierten SVA-Standardtext verwenden.

### Non-Goals

- Studio-eigener SMTP-Transport oder Action-Token-Erzeugung;
- beliebige E-Mail-Typen, Layout-Builder oder Marketing-Templates;
- tenantseitige Self-Service-Delegation;
- mehrere Sprachen je Instanz im ersten Lieferabschnitt.

## Decisions

### Studio hält den gewünschten Zustand, Keycloak den wirksamen Versandzustand

Die optionale Individualvorlage wird als typisiertes, versioniertes Objekt an
der Instanz gespeichert. Das Objekt enthält ausschließlich:

- `revision`
- `subject`
- `body`
- `passwordSetupLinkLabel`
- `tenantHomepageLinkLabel`

Eine fehlende Vorlage bedeutet „SVA-Standard verwenden“. Die Vorlage enthält
weder Realmname noch Hostname als kopierte Werte. `displayName` und die
HTTPS-Startseiten-URL werden bei Vorschau und Projektion aus dem aktuellen
Instanzdatensatz abgeleitet. Dadurch bleiben Realm- und Hostzuordnung die
führenden bestehenden Verträge.

Die Keycloak-Realm-Overrides sind eine abgeleitete Projektion und keine zweite
fachliche Quelle. Der Detail-Read vergleicht die kompilierten Sollwerte mit den
aktuellen drei Realm-Schlüsseln und liefert einen begrenzten Zustand
`default | in_sync | drifted | unavailable` zurück.

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

### Bestehendes Theme und bestehender Realm-Adminpfad werden erweitert

`sva-kern2` erhält den Theme-Typ `email` und deutsche Standardwerte für
`executeActionsSubject`, `executeActionsBody` und `executeActionsBodyHtml`.
Neue Realms setzen neben dem Login-Theme auch `emailTheme = sva-kern2` über die
bereits vorhandene Realm-Baseline.

Für bestehende Realms erfolgt keine Fleet-Mutation. Erst eine ausdrückliche
Speicherung oder „Auf Standard zurücksetzen“ setzt das E-Mail-Theme im exakt
zugeordneten Realm und schreibt beziehungsweise entfernt die drei Overrides.
Die vorhandene Instanz-Keycloak-Control-Plane wird um die benötigten
Lokalisierungsoperationen erweitert; es entsteht kein neuer Service und kein
alternativer Provisioner.

### UI bleibt Teil der Instanzverwaltung

Die bestehende Instanzdetailseite erhält im Konfigurationsbereich die Aktion
„Account-Einladung anpassen“. Sie verwendet die vorhandene Plattform-
Autorisierung für Instanzänderungen. Eine neue Permission oder eine zweite
Administrationsroute ist für diesen Lieferabschnitt nicht erforderlich.

Der Dialog zeigt:

- Betreff und Nachricht;
- die zwei Linkbeschriftungen;
- die erlaubten Platzhalter;
- eine Vorschau mit nicht produktiven Beispieldaten;
- den Projektionszustand;
- „Speichern“ und „Auf Standard zurücksetzen“.

Vorschauen dürfen niemals einen echten Keycloak-Aktionslink oder Empfänger-PII
anfordern oder darstellen. Erfolg und Fehler werden als zugängliche
Statusmeldung mit `role="status"` ausgegeben.

### Revisions- und Projektionsvertrag

Der Client sendet beim Speichern die zuletzt gelesene Vorlagenrevision. Eine
abweichende Revision wird vor Persistenz und Keycloak-Mutation als Konflikt
abgewiesen.

Nach erfolgreicher Persistenz kompiliert der Server die Vorlage, projiziert die
drei freigegebenen Schlüssel und liest sie kausal zurück. Ein Teilfehler wird
nicht als Erfolg ausgegeben: Der gewünschte Zustand bleibt gespeichert, der
Readback zeigt `drifted` oder `unavailable`, und dieselbe Revision kann über die
vorhandene Aktion erneut projiziert werden. Der Retry schreibt stets alle drei
Schlüssel idempotent und erweitert die Mutation nicht auf andere
Realm-Lokalisierungen.

Beim Zurücksetzen wird die Individualvorlage revisionsgebunden entfernt, das
Realm auf `emailTheme = sva-kern2` ausgerichtet und ausschließlich die drei
Individual-Overrides werden entfernt. Andere Realm-Überschreibungen bleiben
unverändert.

### Einladung bleibt Keycloak-owned und fail-closed für Custom-Drift

Der vorhandene Account-Erstellungs- und Resend-Pfad ruft weiterhin nur
`execute-actions-email` auf. Ist für die Instanz eine Individualvorlage
gespeichert, verifiziert der Server vor dem Aufruf, dass die drei aktuellen
Realmwerte der kompilierten Revision entsprechen. Bei Drift oder nicht
lesbarem Realm wird keine Einladung mit möglicherweise falschem Inhalt
versendet.

Die Accountanlage bleibt dabei gemäß bestehendem Vertrag erfolgreich; nur der
Einladungsstatus wird als fehlgeschlagen gemeldet. Ein späterer Resend verwendet
denselben Prüfpfad. Ohne Individualvorlage bleibt das bisherige Verhalten für
Bestandsrealms erhalten; neu provisionierte oder ausdrücklich zurückgesetzte
Realms verwenden den SVA-Standardtext.

## Errors and recovery

| Zustand | Verhalten |
| --- | --- |
| ungültiger oder unbekannter Platzhalter | `invalid_request` vor Persistenz und Keycloak-Zugriff |
| konkurrierende Revision | `conflict`, keine Mutation |
| Realm gehört nicht eindeutig zur Instanz | fail-closed, keine Realm-Mutation |
| Keycloak-Schreibfehler nach Persistenz | gewünschte Revision bleibt gespeichert, Status `drifted`/`unavailable`, expliziter Retry möglich |
| Readback weicht ab | kein Erfolg und kein Versand einer Individualeinladung |
| Reset teilweise fehlgeschlagen | Status bleibt abweichend; Retry entfernt erneut nur die drei verwalteten Schlüssel |
| Keycloak-E-Mail-Versand schlägt fehl | Account bleibt angelegt, Einladung bleibt separat `failed` |

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
- Direkte Keycloak-Änderungen bleiben als Drift sichtbar und können keinen
  Studio-Sollzustand stillschweigend ersetzen.

## Test strategy

- reine Compiler-Tests für alle Platzhalter, Escaping, Plaintext und HTML;
- Negativtests für fehlenden/mehrfachen Passwortlink, unbekannte Tokens, Markup,
  freie URLs und Längenlimits;
- Repository- und Contract-Tests für Revision, Reset und Instanzscope;
- Keycloak-Adaptertests für exakt drei Lokalisierungsschlüssel und kausalen
  Readback;
- Fault-Tests für Teilfehler, Drift und idempotenten Retry;
- IAM-Tests, dass bei Custom-Drift weder Create noch Resend die E-Mail auslösen,
  die Accountanlage aber erhalten bleibt;
- UI-Tests für Vorschau, Konflikt, Projektionsstatus, Reset und barrierefreie
  Rückmeldungen;
- Theme-Paketprüfung sowie Testrealm-Abnahme mit tatsächlichem Mailversand und
  gültigem Passwort-Aktionslink.

## Migration and rollout

1. Additive Datenbankmigration und Theme-Erweiterung ausrollen.
2. Neue Realms erhalten das E-Mail-Theme automatisch über die Baseline.
3. Bestehende Realms bleiben unverändert, bis ihre Vorlage explizit gespeichert
   oder auf den Standard zurückgesetzt wird.
4. Die erste Umgebungsabnahme verwendet einen Testrealm und eine Testadresse.
5. Ein Rollback entfernt die Studio-UI und stoppt weitere Projektionen; bereits
   gesetzte Realm-Overrides bleiben bis zu einer ausdrücklich geprüften
   Rücksetzung wirksam und werden nicht durch ein Downgrade blind gelöscht.

## Open questions

- Soll ein späterer Change die Pflege mit einer eigenen Permission an
  tenantlokale `system_admin`-Nutzer delegieren?
- Benötigen einzelne Instanzen künftig zusätzlich englische Vorlagen, obwohl
  die aktuelle New-Realm-Baseline ausschließlich Deutsch aktiviert?

