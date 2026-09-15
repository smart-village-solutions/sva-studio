# Design: Servergeführte Keycloak-Realm-Baseline

## Ausgangslage

`packages/instance-registry` besitzt bereits den kanonischen Preflight-, Plan-, Execute- und Readback-Pfad. `packages/auth-runtime` kapselt die Keycloak Admin API. Die Realm-Erstellung setzt heute im Wesentlichen Realmname, `enabled` und Anzeigename; Client-, Secret-, Rollen- und Tenant-Admin-Schritte folgen separat. Adapterfunktionen für additive Benutzerprofilattribute und User-Attribute-Mapper existieren bereits, sind aber nicht in den Realm-Baseline-Ablauf eingebunden.

Die konkrete Lücke ist ein servergeführter Sollvertrag für wiederkehrende Realm-Einstellungen. Direkter Verbraucher ist der vorhandene Instanz-Provisioner. Die bestehende Client-URL-Konfiguration wird nicht zu einer gemischten Realm-Policy-Datei ausgebaut; stattdessen entsteht genau ein eng begrenztes Baseline-Modul innerhalb desselben Packages.

## Gewählte Lösung

### Versionierte serverseitige Baseline

`packages/instance-registry/src/keycloak-realm-baseline.ts` definiert eine typisierte, server-only verwendete Baseline. Sie wird nicht über den öffentlichen Package-Entry oder in Browser-Bundles exportiert.

Die erste Version enthält:

- `version`
- Standard-IDs für Login- und Tenant-Admin-Client
- `loginTheme = sva-kern2`
- Theme-Attribut für Dark Mode
- `internationalizationEnabled = true`
- `supportedLocales = [de]`
- `defaultLocale = de`
- User- und Admin-Events mit der freigegebenen Aufbewahrungsdauer
- deaktivierte Admin-Event-Details
- additive Studio-eigene Benutzerprofilattribute
- den `instanceId`-Mapper für ID-, Access- und Userinfo-Token
- nicht geheime SMTP-Felder wie Host, Port, Absender, Benutzername und TLS-/STARTTLS-Modus

Die Baseline enthält weder Passwort noch einen Passwort-Platzhalter. Ein Klartext-Platzhalter wäre nach einem Keycloak-Read nur noch als maskierter Wert sichtbar, könnte fälschlich als konfiguriertes Secret gelten und bei versehentlichen Versandversuchen echte SMTP-Anmeldungen auslösen.

### Auflösung beim Erstellen

Für `realmMode = new` leitet der Server technische Standardwerte ab:

- `authRealm` aus der `instanceId`
- `authClientId` aus der Baseline
- Tenant-Admin-Client-ID aus der Baseline
- Issuer aus Keycloak-Basis-URL und Realm
- Realm-Einstellungen aus der Baseline

Alte oder automatisierte Clients dürfen diese Felder weiterhin mitsenden. Ein mitgesendeter Wert muss dem abgeleiteten Soll entsprechen; ein Konflikt wird vor Registry- oder Keycloak-Mutation mit einem stabilen Validierungsfehler abgewiesen.

Für `realmMode = existing` bleiben die technischen Eingaben und der bisherige Bestandsvertrag unverändert. Der neue Baseline-Intent verändert bestehende Realms nicht implizit.

### Snapshot und Retry

Baseline-Version und semantischer Baseline-Fingerprint werden in den vorhandenen Desired Snapshot und die Keycloak-Run-Details aufgenommen. Ändert sich die kompilierte Baseline zwischen Planung und Ausführung, bricht der alte Auftrag fail-closed ab und muss neu geplant werden.

Es entsteht keine neue Persistenztabelle. Nicht geheime Plan- und Readback-Evidenz passt in die vorhandenen Snapshot- und Run-Details.

## Provisionierungsablauf

1. Der Server validiert Tenant-Eingaben und löst die Baseline auf.
2. Preflight prüft den Keycloak-Zugriff und verhindert die Übernahme eines bereits vorhandenen Realms im Modus `new`.
3. Der Plan weist die Baseline und das manuelle SMTP-Passwort als eigene Schritte aus.
4. Das Realm wird mit den Baseline-Realmwerten angelegt.
5. Der vorhandene Pfad erstellt Login-, Tenant-Admin- und Plugin-OIDC-Clients sowie Secrets.
6. Studio-eigene Benutzerprofilattribute werden additiv ergänzt; unbekannte und tenant-spezifische Attribute bleiben erhalten.
7. Der `instanceId`-Mapper wird am tatsächlich aufgelösten `authClientId` idempotent angelegt.
8. Rollen und Tenant-Admin werden über den vorhandenen Pfad hergestellt.
9. Ein kausaler Readback bewertet alle automatischen und manuellen Punkte.
10. Automatische Drift lässt den Lauf fehlschlagen; das noch fehlende SMTP-Passwort bleibt als nicht blockierende betriebliche Nacharbeit sichtbar.

Alle Schreiboperationen bleiben im bestehenden Provisioner. Scheitert ein Schritt nach der erstmaligen Realm-Erstellung, umfasst die vorhandene Kompensation den gesamten neu erzeugten Realm oder liefert einen sicheren manuellen Cleanup-Befund. Ein Retry darf weder einen fremden Bestands-Realm übernehmen noch eine neue Baseline-Version einmischen.

## SMTP und Recovery

### Automatischer Anteil

Die Baseline setzt ausschließlich die nicht geheimen SMTP-Werte. Bei späteren Realm-Patches wird das Feld `smtpServer.password` immer ausgelassen, damit ein manuell gesetztes Passwort niemals überschrieben oder durch einen maskierten Wert ersetzt wird.

### Manueller Anteil

Nach der Realm-Erstellung meldet der Status `smtp_password_required`. Die UI erklärt ohne Secret-Wert:

1. SMTP-Passwort einmalig in der Keycloak-Administration setzen.
2. Die SMTP-Verbindung anschließend direkt in Keycloak testen.

Ein maskierter Keycloak-Wert wie `********` beweist nur, dass ein Wert gespeichert ist. Studio verwendet ihn ausschließlich für den booleschen Konfigurationsstatus, gibt ihn nie zurück und schreibt ihn nie nach Keycloak. Ein automatischer SMTP-Test oder eine Secret-Übernahme ist bewusst nicht Teil dieses schmalen Changes.

## Status- und UI-Vertrag

Die bestehende Keycloak-Statusquelle wird um Realm-Baseline, Benutzerprofil, Mapper und den booleschen SMTP-Passwortstatus ergänzt. Der manuelle Schritt trägt stabile `reasonCode`- und `actionCode`-Werte; sichtbare Texte kommen ausschließlich aus den deutschen und englischen Übersetzungsressourcen.

Der New-Realm-Dialog fragt weiterhin nur echte Tenantdaten ab. Technische Standardwerte werden nicht editierbar abgefragt, sondern in der Review-Zusammenfassung als serverseitige Baseline angezeigt. Der Existing-Realm-Pfad behält seine expliziten technischen Felder.

Manuelle Nacharbeiten erscheinen über den bestehenden Plan, das Run-Protokoll und den Keycloak-Status. Es entsteht kein zweites Aufgaben- oder Acknowledgement-System. Erfüllung wird ausschließlich als aktueller boolescher Passwort-Konfigurationsstatus gelesen.

## Fehler- und Sicherheitsverhalten

- Eine ungültige kompilierte Baseline schlägt in Tests beziehungsweise beim Serverstart fehl.
- Konfligierende New-Realm-Eingaben werden vor Mutation abgewiesen.
- Automatisierbare Baseline-Drift lässt den Provisioning-Lauf fehlschlagen.
- Ein fehlendes SMTP-Passwort ist ein erwarteter, nicht blockierender manueller Zustand und kein unbekannter technischer Fehler.
- Logs, Audit, Snapshots und Browserantworten enthalten keine Passwörter, Tokens, SMTP-Empfänger oder vollständigen Keycloak-Antworten.

## Bewusste Ausgrenzung

Passwort-Policy, MFA/WebAuthn, Brute-Force-Schutz, Session-/Token-Laufzeiten, Key-Rotation, externe Identity Provider und tenant-spezifische Sonder-Themes bleiben außerhalb dieser Baseline. Sie werden als nicht anwendbar oder manuelle Folgearbeit sichtbar, aber nicht ohne freigegebenen Vertrag automatisiert.
