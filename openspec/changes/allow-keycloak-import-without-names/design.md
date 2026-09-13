## Context

Der tenantlokale Keycloak-Import löst Profilwerte derzeit in der Reihenfolge `Quellwert -> instanz- und subjectgebundener lokaler Seed -> syntaktisch gültiger Username nur als E-Mail` auf. Anschließend verlangt er E-Mail, Vorname und Nachname gemeinsam. Fehlt einer dieser Werte weiterhin, wird der betroffene Benutzer nicht in IAM persistiert.

Produktionsnachweise für `hb-meinquartier` zeigen, dass derselbe Bestand dadurch bei wiederholten manuellen Syncs erneut als `identity_profile_incomplete` gemeldet wird. Die IAM-Persistenz unterstützt fehlende Vor- und Nachnamen bereits; `displayName` fällt auf Username, E-Mail oder Subject zurück.

## Goals / Non-Goals

### Goals

- Alle tenantlokalen Keycloak-Benutzer mit auflösbarer E-Mail werden subjectgebunden als Account und Member übernommen.
- Eine nicht auflösbare E-Mail bleibt ein blockierender, fachlicher Prüfzustand.
- Vorhandene Profilwerte und subjectgebundene lokale Seeds behalten ihre bisherige Priorität.
- Fehlende Namen führen weder zu erfundenen Keycloak-Daten noch zu wiederholten Warnereignissen.

### Non-Goals

- Keine Änderung des Studio-Formularvertrags für neu angelegte Benutzer.
- Keine neue Datenbankspalte, Migration oder persistierte Review-Queue.
- Keine Änderung der technischen-Account-Klassifikation oder des Sync-Scopes.
- Keine automatische Identitätszusammenführung über E-Mail.
- Keine neuen Default-Namen in Keycloak oder IAM.

## Decision

Die Profilauflösung bleibt unverändert. Nach der Auflösung prüft der Import jedoch nur noch, ob eine nichtleere E-Mail vorhanden ist. Fehlen Vor- oder Nachname weiterhin, wird der Benutzer mit optionalen Namensfeldern persistiert und erhält wie bisher eine subjectgebundene Membership.

Eine bereits vorhandene Keycloak-E-Mail bleibt gegenüber einem abweichenden lokalen Seed vorrangig. Nur eine fehlende E-Mail darf weiterhin aus dem lokalen Seed desselben Tenants und Subjects oder zuletzt aus einem syntaktisch gültigen Username ergänzt werden. Bleibt sie unaufgelöst, erfolgt keine IAM-Persistenz und der Benutzer wird als `identity_profile_incomplete` in `manual_review` gezählt.

Ein fehlender Name wird nicht durch `Unbekannt` oder einen anderen Platzhalter ersetzt. Die bestehende Anzeigenamensauflösung in IAM verwendet vorhandene Namen und fällt andernfalls auf Username, E-Mail oder Subject zurück. Oberflächen dürfen einen übersetzten Anzeigehinweis verwenden, ohne ihn als Profildatum zu persistieren.

## Data Flow

1. Der Sync listet die Benutzer des aufgelösten tenantlokalen Keycloak-Realms.
2. Für jedes Subject werden vorhandene Quellwerte und der ausschließlich für dieselbe Instanz und dasselbe Subject geladene lokale Seed ausgewertet.
3. Auflösbare fehlende Felder dürfen über den bestehenden Provider-Pfad am exakten Keycloak-Subject repariert werden.
4. Ist die E-Mail anschließend vorhanden, wird der IAM-Account mit optionalen Namensfeldern upserted und die Membership idempotent sichergestellt.
5. Ist die E-Mail weiterhin nicht vorhanden, wird der Item-Savepoint zurückgerollt und der Fall als `manual_review` gezählt.
6. Der Gesamtreport bleibt `partial_failure` beziehungsweise `failed`, solange mindestens eine E-Mail nicht aufgelöst werden kann.

## Invariants and Failure Modes

- **IAM-IMPORT-1 – Subject-Bindung:** Lookup, Keycloak-Mutation, Account-Upsert und Membership bleiben an dieselbe `instanceId` und dasselbe Keycloak-Subject gebunden.
- **IAM-IMPORT-2 – Quellwertvorrang:** Eine vorhandene Keycloak-E-Mail oder ein vorhandener Name wird nicht durch einen lokalen Seed oder Default überschrieben.
- **IAM-IMPORT-3 – E-Mail fail-closed:** Eine nach allen bestehenden vertrauenswürdigen Fallbacks fehlende E-Mail erzeugt keine Account- oder Membership-Persistenz.
- **IAM-IMPORT-4 – Keine erfundenen Namen:** Fehlende Namen bleiben optional; weder Keycloak noch IAM erhalten Platzhalter-Profildaten.
- **IAM-IMPORT-5 – Datenschutz:** Logs und Reports enthalten keine Profilwerte, sondern nur bestehende Zähler, Ursachen und pseudonymisierte Subject-Verweise.
- **IAM-IMPORT-6 – Wiederholung:** Ein erneuter Sync eines nur hinsichtlich der Namen unvollständigen Profils erzeugt keinen `manual_review`-Warnzustand und bleibt idempotent.

Ein separates `assurance.md` ist nicht erforderlich: Die Änderung bleibt in einem synchronen, bestehenden Item-Savepoint begrenzt, führt keine neue Trust Boundary und keinen neuen persistenten Zustand ein. Die relevanten Datenintegritäts- und Datenschutzinvarianten sind oben vollständig festgehalten.

## Test Strategy

- Unit-Reproduktion: vorhandene E-Mail bei fehlenden beiden Namen wird persistiert und nicht als `manual_review` gezählt.
- Varianten: nur Vorname oder nur Nachname fehlt; Leerzeichen werden wie fehlende Werte behandelt.
- Positivpfade: Namen werden weiterhin aus demselben subjectgebundenen lokalen Seed repariert, sofern vorhanden.
- E-Mail-Grenze: fehlende E-Mail ohne auflösbaren Seed oder E-Mail-Username bleibt `manual_review` ohne Persistenz.
- Vorrang: vorhandene Quell-E-Mail bleibt bei widersprüchlichem Seed unverändert.
- Wiederholung: derselbe namenlose Benutzer kann erneut idempotent synchronisiert werden, ohne Warnung oder doppelte Membership.
- Logging: keine Namen, E-Mail-Adressen oder Klartext-Subjects in Warn- und Abschlusslogs.
