# Prüfprotokolle Datenschutz und Compliance

## Zweck

Dieses Dokument stellt konkrete Prüfschemata für umgebungsabhängige Nachweise
bereit. Es erzeugt selbst noch keine Evidence, sondern definiert reproduzierbare
Prüfschritte.

## 1. RLS- und Rollenprüfung

Ziel:

- wirksame Rollenbegrenzung im Zielsystem belegen
- Laufzeitrolle und Deny-Pfade nachvollziehen

Beispielhafte Prüffragen:

1. Mit welcher DB-Rolle läuft die Anwendung?
2. Besitzt diese Rolle `SUPERUSER` oder `BYPASSRLS`?
3. Welche RLS-Policies schützen die sensiblen IAM-Tabellen?
4. Welche Zugriffe sind für App-Runtime erlaubt, welche verboten?

Erwartete Evidence:

- SQL-Output
- kurze Auswertung
- dokumentierte Allow-/Deny-Fälle

## 2. Retention-Prüfung

Ziel:

- tatsächliche tägliche Ausführung und Alarmierung belegen

Prüfschritte:

1. Scheduler-Eintrag oder Jobdefinition dokumentieren.
2. letzten erfolgreichen Lauf mit Zeitstempel und Ergebnissen sichern.
3. Alarmregel oder Fehlertest dokumentieren.
4. Wachstum und Alter von `iam.platform_activity_logs` bewerten.

## 3. Governance-/Consent-Exportprüfung

Ziel:

- Audit-Exportfähigkeit und Zugriffsbeschränkung belegen

Prüfschritte:

1. Export mit berechtigter Rolle ausführen.
2. Export mit unberechtigter Rolle als Negativtest ausführen.
3. Ergebnis auf Pflichtfelder, Pseudonymisierung und Scope prüfen.

## 4. Log-Redaction-Prüfung

Ziel:

- wirksame Redaction in realen Laufzeitdaten belegen

Prüfschritte:

1. Stichprobe aus Zielsystem oder Staging ziehen.
2. Nach typischen Mustern suchen: E-Mail, JWT, Cookie, Bearer-Token,
   `client_secret`, `refresh_token`, `authorization`.
3. Treffer analysieren und als zulässig oder unzulässig bewerten.
4. Falls unzulässige Treffer existieren, Incident oder Fix-Maßnahme eröffnen.

## 5. Compliance-Gate-Business-Flows

Ziel:

- Nachweis, dass Schutzmaßnahmen nicht nur im Code stehen, sondern echte
  Business-Flows kontrollieren

Mindestfälle:

1. geschützter IAM-Flow ohne gültige Legal-Akzeptanz wird blockiert
2. geschützter IAM-Flow mit gültiger Akzeptanz wird erlaubt
3. Governance-Ausnahmefall wird nur für definierte Operationen gewährt
4. Audit-/Korrelationsdaten entstehen nachvollziehbar

Empfohlene Evidence:

- Testlauf-Log
- Screenshots oder API-Responses
- Kurzbewertung pro Fall
