# Assurance: Instanzbezogene Account-Einladung

## Kritische Grenzen

Der Change koppelt einen in der Studio-Registry gespeicherten Solltext mit
Realm-Lokalisierungswerten, die Keycloak beim Erzeugen eines signierten
Passwort-Aktionslinks tatsächlich versendet. Kritisch sind die exklusive
Instanz-/Realm-Zuordnung, die Unveränderlichkeit der Link-Ownership und das
Verhalten bei Teilfehlern oder direktem Realm-Drift.

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

### AIT-4 – Passwortlink ist in jeder Individualvorlage genau einmal vorhanden

Eine Individualvorlage ohne oder mit mehrfach eingefügtem
`{{passwordSetupLink}}` ist ungültig und darf nicht persistiert oder projiziert
werden.

Nachweis:

- Schema- und Servicetests für null, eins und mehrere Vorkommen;
- Readback-Test bestätigt `{0}` genau einmal in Plaintext und HTML;
- UI zeigt den Validierungsfehler am Nachrichtentext.

### AIT-5 – Teilfehler werden nicht als aktive Vorlage behauptet

Persistierter Sollzustand, Keycloak-Write und Readback sind getrennte Zustände.
Nur ein exakter Readback aller drei verwalteten Schlüssel gilt als `in_sync`.

Nachweis:

- Fault-Tests nach jedem Keycloak-Schreibschritt und vor dem Readback;
- Drift-Test mit genau einem abweichenden Schlüssel;
- idempotenter Retry stellt alle drei Schlüssel her, ohne fremde Overrides zu
  verändern;
- UI- und API-Tests unterscheiden `in_sync`, `drifted` und `unavailable`.

### AIT-6 – Custom-Drift verhindert falschen Einladungsversand

Ist eine Individualvorlage gespeichert, darf weder Create noch Resend
`execute-actions-email` auslösen, solange der aktuelle Realm-Readback nicht zur
gespeicherten Revision passt.

Nachweis:

- IAM-Integrationstests für Create und Resend mit `in_sync`, `drifted` und
  `unavailable`;
- Spies bestätigen ausbleibenden Versand bei Drift;
- bestehende Tests bestätigen, dass die Accountanlage trotz isoliertem
  Einladungsfehler erfolgreich bleibt.

### AIT-7 – Reset entfernt nur Studio-owned Einladungsschlüssel

„Auf Standard zurücksetzen“ darf ausschließlich die Individualvorlage und die
drei verwalteten Realm-Overrides entfernen sowie das freigegebene E-Mail-Theme
setzen. Andere Lokalisierungswerte und Theme-Artefakte bleiben unverändert.

Nachweis:

- Adaptertest mit zusätzlichen fremden Realm-Overrides;
- Readback bestätigt den SVA-Standardtext;
- Retry- und Teilfehlertest für einen unterbrochenen Reset.

### AIT-8 – Konkurrierende Bearbeitung überschreibt keine neuere Revision

Eine veraltete Browseransicht darf weder die aktuelle Studio-Vorlage noch den
Realm verändern.

Nachweis:

- Repository- und HTTP-Tests mit zwei konkurrierenden Revisionen;
- der Konflikt entsteht vor Keycloak-Zugriff;
- UI fordert nach Konflikt zum Neuladen auf und behält keinen falschen
  Erfolgszustand.

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

Noch offen bleiben die vollständige Teilfehlermatrix, der abschließende Nachweis
aller Invarianten am finalen Commit sowie die Testrealm-Abnahme.
