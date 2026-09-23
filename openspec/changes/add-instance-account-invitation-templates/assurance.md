# Assurance: Instanzbezogene Account-Einladung

## Kritische Grenzen

Der Change koppelt einen server- oder instanzbezogen in der Studio-Datenbank gespeicherten Solltext mit
Realm-Lokalisierungswerten, die Keycloak beim Erzeugen eines signierten
Passwort-Aktionslinks tatsächlich versendet. Kritisch sind die exklusive
Instanz-/Realm-Zuordnung, die Unveränderlichkeit der Link-Ownership und die
bedarfsgesteuerte Sicherstellung unmittelbar vor dem Versand.

## Invarianten und geplante Nachweise

### AIT-1 – Aktionslink bleibt ausschließlich Keycloak-owned

Das Studio darf keinen Aktionstoken erzeugen, signieren, speichern, aus einer
Admin-Antwort extrahieren oder in einer Vorschau simulieren.

Nachweis:

- Adapter- und IAM-Tests belegen, dass der Versand weiterhin ausschließlich
  `execute-actions-email` mit `UPDATE_PASSWORD` aufruft;
- Contract- und Snapshot-Tests schließen Link-, Token- oder Credential-Felder
  aus Studio-Persistenz, API-Antworten, Logs und Audit aus;
- Code-Review des Einladungspfads und der Vorschau.

### AIT-2 – Eine Instanz mutiert ausschließlich ihren exklusiven Realm

Eine Vorlagenmutation muss `instanceId`, `authRealm` und die eindeutige
Realm-Zuordnung vor jedem Keycloak-Write auflösen. Mehrdeutige, fehlende oder
abweichende Zuordnung bricht fail-closed ab.

Nachweis:

- Integrationstests mit korrektem, fremdem, fehlendem und doppelt beobachtetem
  Realm;
- Adapter-Spies belegen, dass bei einem Scope-Fehler kein Write erfolgt;
- Datenbankconstraint und Registry-Tests bestätigen exklusives `authRealm`.

### AIT-3 – Benutzertext kann keinen fremden Link oder aktiven Inhalt einführen

Nur die vier freigegebenen Platzhalter sind zulässig. HTML, Script, freie
URI-Schemata und unbekannte Platzhalter gelangen weder in Plaintext noch HTML.

Nachweis:

- tabellengetriebene Negativtests für HTML, Attribute, URI-Schemata,
  MessageFormat-Sonderzeichen und unbekannte Tokens;
- Compiler-Tests bestätigen vollständiges Escaping und ausschließlich
  serverseitig erzeugte Anchors;
- Property-/Fuzz-nahe Tests für Klammern, Apostrophe, Unicode und Zeilenumbrüche.

### AIT-4 – Passwortlink ist in jeder gespeicherten Vorlage genau einmal vorhanden

Eine Server- oder Individualvorlage ohne oder mit mehrfach eingefügtem
`{{passwordSetupLink}}` ist ungültig und darf nicht persistiert oder für einen Versand verwendet
werden.

Nachweis:

- Schema- und Servicetests für null, eins und mehrere Vorkommen;
- Readback-Test bestätigt `{0}` genau einmal in Plaintext und HTML;
- UI zeigt den Validierungsfehler am Nachrichtentext.

### AIT-5 – Die Vererbung liefert genau eine wirksame Vorlage

Die Auflösung muss deterministisch Instanzvorlage, Servervorlage und danach den
eingebauten SVA-Standard wählen. Servertexte dürfen nicht in Instanzdatensätze
kopiert werden.

Nachweis:

- Resolver-Tests für alle drei Quellen und beide Rücksetzungen;
- Repository-Tests belegen revisionsgebundene Server- und Instanzwerte;
- UI-Tests zeigen die Quelle der wirksamen Vorlage ohne globalen
  Projektionsstatus.

### AIT-6 – Versand erfolgt erst nach bestätigter wirksamer Vorlage

Weder Create noch Resend darf `execute-actions-email` auslösen, solange die
drei Realmwerte nicht exakt der kompilierten wirksamen Vorlage entsprechen.
Eine Abweichung wird für diesen Realm idempotent korrigiert und zurückgelesen.

Nachweis:

- IAM-Integrationstests für Create und Resend mit bereits passendem Text,
  erfolgreicher Aktualisierung sowie Write- und Readbackfehlern;
- Spies bestätigen, dass nur die drei verwalteten Schlüssel geschrieben werden
  und bei nicht bestätigtem Readback kein Versand erfolgt;
- bestehende Tests bestätigen, dass die Accountanlage trotz isoliertem
  Einladungsfehler erfolgreich bleibt.

### AIT-7 – Speichern und Reset mutieren keinen Realm

Das Speichern oder Zurücksetzen einer Server- oder Instanzvorlage darf nur den
Studio-Sollzustand verändern. Die Realmwerte werden erst vor dem nächsten
konkreten Versand bedarfsgesteuert ausgerichtet.

Nachweis:

- Service-Spies bestätigen, dass Template-Mutationen keinen Keycloak-Write
  auslösen;
- Resolver-Tests bestätigen nach Instanz-Reset den Servertext und nach
  Server-Reset den SVA-Standard;
- der nächste Versand überschreibt ausschließlich die drei verwalteten
  Einladungsschlüssel und lässt fremde Lokalisierungen unverändert.

### AIT-8 – Konkurrierende Bearbeitung überschreibt keine neuere Revision

Eine veraltete Browseransicht darf weder die aktuelle Studio-Vorlage noch den
Realm verändern.

Nachweis:

- Repository- und HTTP-Tests mit zwei konkurrierenden Revisionen;
- der Konflikt entsteht vor Keycloak-Zugriff;
- UI fordert nach Konflikt zum Neuladen auf und behält keinen falschen
  Erfolgszustand.

### AIT-9 – Servervorlage bleibt Plattformadministration

Nur Aufrufer mit der bestehenden Plattformberechtigung
`instance.registry.manage` dürfen die Servervorlage lesen oder verändern. Die
neue Route darf keine tenantlokale Rollenabkürzung einführen.

Nachweis:

- HTTP- und Navigationstests für berechtigte und unberechtigte Aufrufer;
- Mutationstests bestätigen die Autorisierung vor jedem Datenbank-Write;
- Audit enthält nur Vorlagenschlüssel, Revision, Actor und Ergebnis, niemals
  den Vorlagentext.

## Abnahmegrenze

Unit-, Contract- und Theme-Tests allein belegen den produktiven Mailpfad nicht.
Vor Merge ist ein integrationsnaher Test gegen eine unterstützte
Keycloak-Version erforderlich. Vor produktiver Nutzung ist zusätzlich in einem
Testrealm nachzuweisen, dass Standard, Individualvorlage, Reset, Ablaufanzeige,
Tenant-Startseite und der tatsächliche `UPDATE_PASSWORD`-Link gemeinsam
funktionieren. Der Nachweis verwendet ausschließlich Testaccounts und enthält
keinen Aktionslink oder Token im abgelegten Bericht.

## Evidenz im Implementierungsstand

Für den aktuellen Arbeitsstand sind folgende lokale Nachweise grün:

- Compiler- und Validierungstests in
  `packages/core/src/instances/account-invitation-template.test.ts`;
- revisionsgebundene Repository- und Service-Tests einschließlich eines
  veralteten Reset-Versuchs vor jedem Realm-Write;
- Keycloak-Adaptertests für die eng begrenzten Realm-Lokalisierungsoperationen;
- Einladungsschutztests für exakte Texte und das aktive E-Mail-Theme sowie
  Create-/Resend-Integrationstests für Drift ohne E-Mail-Versand;
- UI-Interaktionstests für sichere Vorschau, Speichern und bestätigten Reset;
- Typechecks der betroffenen Projekte sowie `check:server-runtime`,
  `check:file-placement`, `git diff --check` und die strikte OpenSpec-Validierung.

Zusätzlich belegen Resolver-, Konfigurations-, HTTP- und UI-Tests die
Serververerbung, den autorisierten Server-Override, den revisionsgebundenen
Reset und die bedarfsgesteuerte Sicherstellung vor Create und Resend. Offen
bleibt die Testrealm-Abnahme gegen eine unterstützte Keycloak-Version.
