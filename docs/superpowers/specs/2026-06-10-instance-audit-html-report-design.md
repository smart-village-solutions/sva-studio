# Instanz-Audit mit HTML-Report Design

## Kontext

Für das produktionsnahe `studio`-Profil soll ein read-only Audit-Skript entstehen, das automatisch alle relevanten Instanzen aus der Registry lädt, die betriebsrelevanten Tenant-, Keycloak- und IAM-Prüfungen ausführt und das Ergebnis als HTML-Report schreibt.

Der Bedarf ist operativ: Die Prüfung soll nicht nur einzelne technische Aspekte wie Realm-Existenz oder Host-Erreichbarkeit punktuell verifizieren, sondern pro Instanz ein belastbares Gesamtbild liefern, das für Triage, Screenshot-/Weitergabe und wiederholbare Kontrollläufe geeignet ist.

Die bisherigen Anforderungen sind bereits fachlich eingegrenzt:

- die Zielinstanzen werden automatisch aus `iam.instances` geladen
- der Lauf erfolgt gegen das produktionsnahe `studio`-Profil
- das Skript führt alle Checks selbst aus
- das primäre Ergebnisartefakt ist eine HTML-Datei

Die Repository-Regeln erzwingen dabei eine saubere Platzierung:

- operative Skripte gehören unter `scripts/ops/`
- Ergebnisberichte gehören unter `docs/reports/`
- Root-Markdown oder ad-hoc-Dateien außerhalb dieser Orte sind nicht zulässig

## Ziele

- Ein einzelnes CLI-Skript führt den vollständigen Audit-Lauf gegen das `studio`-Profil aus.
- Das Skript lädt die Zielinstanzen automatisch aus der Registry, statt eine manuelle Instanzliste zu verlangen.
- Der Audit bleibt strikt read-only gegenüber Registry, Keycloak, Datenbank und Tenant-Hosts.
- Das Ergebnis wird als HTML-Report unter `docs/reports/` geschrieben.
- Pro Instanz werden alle vereinbarten Pflichtprüfungen sowie definierte Warnprüfungen ausgeführt.
- Das Ergebnis ist operator-tauglich: übersichtlich, farblich eindeutig, screenshot-fähig und ohne Client-JavaScript nutzbar.
- Die interne Struktur des Skripts bleibt testbar und in klar getrennte Verantwortlichkeiten aufgeteilt.

## Nicht-Ziele

- Keine automatische Reparatur oder Reconcile-Mutation.
- Kein Browser-Flow und keine Session- oder UI-Automation.
- Kein allgemeines Monitoring-Dashboard oder persistenter Web-Service.
- Keine kontinuierliche Speicherung historischer Audit-Läufe in einer Datenbank.
- Keine Änderung des bestehenden Instanz- oder Keycloak-Provisioning-Vertrags.
- Kein voll generisches Audit-Framework für beliebige Runtime-Profile in dieser ersten Ausbaustufe.

## Bestehender Stand

- Die Registry ist bereits führend für `instanceId`, `primaryHostname`, `parentDomain`, `authRealm`, `authClientId` sowie tenant-spezifische Secret- und Tenant-Admin-Metadaten.
- Das `studio`-Profil und die Runtime-/Secret-Auflösung sind im Repo dokumentiert und implementiert.
- Tenant-spezifische Auth- und Admin-Secrets werden serverseitig aus `iam.instances` geladen und mit `ENCRYPTION_KEY` entschlüsselt.
- Die bestehende Runtime enthält bereits fachliche Prüfpfade für:
  - Realm-/Client-Status
  - Tenant-IAM-Zugriff
  - Tenant-Admin- und `system_admin`-Synchronität
- `kcadm.sh` ist lokal verfügbar und kann für read-only Keycloak-Inspektionen genutzt werden.
- Die lokalen IAM-Daten liegen in der Datenbank und können für die lokale `system_admin`-Prüfung ergänzt werden.

## Bewertete Ansätze

### Ansatz A: monolithisches Ein-Datei-Skript

Ein einzelnes `tsx`-Skript lädt die Registry, prüft HTTP, Datenbank und Keycloak und rendert direkt HTML.

Vorteile:

- schneller Initialaufwand
- wenig Struktur-Overhead

Nachteile:

- schwache Testbarkeit
- hohe Kopplung von I/O, Fachlogik und Rendering
- spätere Erweiterungen wie JSON-Ausgabe oder neue Checks werden unnötig teuer

### Ansatz B: Audit-Engine mit getrenntem HTML-Renderer

Ein CLI-Einstieg orchestriert mehrere klar getrennte Bausteine:

- Registry-Discovery
- Check-Runner
- Ergebnisaggregation
- HTML-Renderer

Vorteile:

- gute Testbarkeit
- klare Verantwortlichkeiten
- gut erweiterbar um zusätzliche Prüfungen oder weitere Ausgabeformate

Nachteile:

- etwas höherer Initialaufwand

### Ansatz C: JSON-first mit separatem HTML-Nachlauf

Das Audit erzeugt zuerst immer ein kanonisches JSON und rendert daraus in einem zweiten Schritt HTML.

Vorteile:

- sehr gut für spätere Weiterverarbeitung
- saubere Trennung von Ergebnismodell und Darstellung

Nachteile:

- zusätzlicher Verarbeitungs- und CLI-Aufwand in der ersten Iteration
- für den aktuellen Bedarf etwas formaler als nötig

## Entscheidung

Es wird Ansatz B umgesetzt, mit einem internen kanonischen Ergebnisobjekt, aber nur einem primären CLI-Einstieg.

Damit bleibt das Skript operator-freundlich und direkt nutzbar, ohne in einen unstrukturierten Monolithen zu kippen. Gleichzeitig entsteht intern bereits ein stabiles Ergebnismodell, das später bei Bedarf auch JSON-Export oder weitere Reportformate tragen kann.

## Zielbild

### 1. CLI-Einstieg und Dateiplatzierung

Das Audit wird als operatives Skript unter `scripts/ops/` angelegt. Ein naheliegender Pfad ist:

- `scripts/ops/studio-instance-audit.ts`

Der HTML-Report wird pro Lauf unter `docs/reports/` erzeugt, zum Beispiel mit einem datierten Dateinamen wie:

- `docs/reports/studio-instance-audit-2026-06-10T12-34-56Z.html`

Zusätzlich darf das Skript optional einen stabilen Alias für den zuletzt erzeugten Lauf schreiben, sofern dieser Pfad ebenfalls unter `docs/reports/` bleibt.

### 2. Laufzeitmodell

Der Skriptlauf ist vollständig read-only und besteht aus fünf Phasen:

1. Runtime- und Secret-Kontext für das `studio`-Profil laden
2. aktive Zielinstanzen aus der Registry laden
3. pro Instanz alle definierten Checks ausführen
4. Ergebnisse aggregieren
5. HTML-Report schreiben

Globale Vorbedingungen wie fehlende Datenbankverbindung, fehlende Secrets oder nicht auflösbares `studio`-Profil beenden den Lauf mit einem Gesamtfehler. Instanzbezogene Fehler beenden dagegen nur die betroffenen Checks, nicht den gesamten Audit.

### 3. Quellen und Zugriffswege

Der Audit nutzt vier Datenquellen:

- Registry-Daten aus `iam.instances`
- HTTP-Checks gegen Tenant-Hosts
- Keycloak-Inspektion gegen die Tenant-Realms
- lokale IAM-Datenbank für den Studio-seitigen `system_admin`-Nachweis

Die Zielinstanzen werden ausschließlich aus der Registry geladen. In der ersten Ausbaustufe werden nur Instanzen mit einem betriebsrelevanten Status geprüft, typischerweise `active`.

### 4. Prüfkategorien

Das Audit gruppiert die Checks pro Instanz in fachlich verständliche Kategorien.

#### Reachability und Registry

- Tenant-Root-URL antwortet
- optionaler Login-Einstieg antwortet technisch plausibel
- `instanceId`, `primaryHostname`, `parentDomain`, `authRealm`, `authClientId` sind gesetzt
- Registry-Status ist für produktiven Betrieb geeignet
- der erwartete Host passt zur Registry

#### Realm und Login-Client

- Tenant-Realm `authRealm` existiert
- Login-Client `authClientId` existiert
- `rootUrl` stimmt exakt
- `redirectUris` stimmen exakt
- `webOrigins` stimmen exakt
- `post.logout.redirect.uris` stimmen exakt
- es existieren keine Fremd-Tenant- oder Root-Host-URLs im Tenant-Client

#### Login-Client-Secret

- tenant-spezifisches Login-Secret ist in der Registry vorhanden
- Secret ist lesbar und entschlüsselbar
- Secret ist mit dem realen Keycloak-Client-Secret aligned

#### Tenant-Admin-Client

- tenant-spezifischer Admin-Client existiert
- `serviceAccountsEnabled` ist aktiv
- unnötige Login-Flows sind nicht aktiv
- die erforderlichen `realm-management`-Rollen sind vorhanden:
  - `manage-users`
  - `view-users`
  - `view-realm`
  - `manage-realm`
  - `manage-clients`

#### Tenant-Admin-Client-Secret

- tenant-spezifisches Admin-Secret ist vorhanden
- Secret ist lesbar und entschlüsselbar
- Secret ist mit dem realen Keycloak-Client-Secret aligned

#### Tenant-IAM-Zugriff

- der Tenant-Admin-Client kann Rollen lesen
- der Tenant-Admin-Client kann Nutzer lesen
- der Tenant-Admin-Client kann den Login-Client technisch auflösen
- es gibt keinen `403`- oder Credential-bedingten Blocker

#### `system_admin` in Keycloak

- Realm-Rolle `system_admin` existiert
- mindestens ein aktiver User hat `system_admin`
- dieser User trägt nicht `instance_registry_admin`

#### `system_admin` lokal im Studio

- mindestens ein lokaler Account ist der Instanz zugeordnet
- mindestens ein lokaler Account besitzt wirksam `system_admin`
- der lokale Befund wird getrennt vom Keycloak-Befund ausgewiesen, damit Drift sichtbar bleibt

#### Optionale Warnprüfungen

- `instanceId`-Mapper fehlt oder ist inkonsistent
- Bootstrap-Admin-Stammdaten sind unvollständig
- nicht-blockierende Realm-Drift außerhalb des harten Login-Vertrags

### 5. Statusmodell

Jeder Einzelcheck liefert:

- `pass`
- `warn`
- `fail`
- optional `skip`, wenn ein nachgelagerter Check wegen fehlender Vorbedingungen fachlich nicht sinnvoll ist

Jeder Check enthält zusätzlich:

- `checkId`
- `title`
- `summary`
- optionale Evidenzdetails
- optionale Fehlerursache
- Dauer oder Zeitstempel, sofern sinnvoll erfassbar

Der Gesamtstatus pro Instanz wird deterministisch aggregiert:

- mindestens ein `fail` -> Instanzstatus `fail`
- sonst mindestens ein `warn` -> Instanzstatus `warn`
- sonst `pass`

Ein globaler Laufstatus wird analog aus allen Instanzstatus und globalen Vorbedingungen gebildet.

### 6. Ergebnisobjekt

Das Skript führt intern ein kanonisches Ergebnisobjekt ein, das mindestens folgende Ebenen abbildet:

- Lauf-Metadaten
- verwendetes Profil
- Zeitpunkt
- geprüfte Instanzen
- pro Instanz:
  - Registry-Kontext
  - Gesamtstatus
  - Kategorien
  - Einzelchecks
  - zusammengefasste Befunde

Dieses Objekt ist die einzige Quelle für die HTML-Erzeugung. HTML wird nicht direkt aus verstreuten Laufzeitwerten zusammengebaut.

### 7. HTML-Report

Der HTML-Report ist ein statisches Artefakt ohne Laufzeit-JavaScript-Abhängigkeit.

Er enthält:

- einen Kopfbereich mit Titel, Profil, Erstellungszeitpunkt und Gesamtzusammenfassung
- Summary-Kacheln für Anzahl `pass`, `warn`, `fail`
- eine Übersicht pro Instanz mit Statusfarbe
- pro Instanz eine Detailsektion mit allen Check-Kategorien und Einzelchecks
- eine kompakte Evidenzdarstellung für Fehl- und Warnfälle

Darstellungsprinzipien:

- hohe Lesbarkeit auf Desktop
- druck- und screenshot-tauglich
- semantisch klares HTML
- dezente, aber eindeutige Farbsemantik
- keine interaktive Abhängigkeit auf JS oder externe Assets

### 8. Fehlerbehandlung und Robustheit

Teilfehler einzelner Checks werden lokal eingefangen und als Check-Ergebnis dokumentiert.

Beispiele:

- Host antwortet nicht -> Reachability-Check `fail`
- Tenant-Secret nicht entschlüsselbar -> Secret-Check `fail`
- Keycloak zeitweise nicht erreichbar -> betroffene Keycloak-Checks `fail`
- optionaler Mapper fehlt -> Warn-Check `warn`

Nur globale Startfehler wie diese beenden den gesamten Lauf sofort:

- `studio`-Profil nicht auflösbar
- IAM-Datenbank nicht erreichbar
- notwendige globale Secrets fehlen
- `kcadm.sh` ist für die gewählte Keycloak-Inspektion zwingend erforderlich und nicht verfügbar

### 9. Implementierungsstruktur

Die erste Ausbaustufe soll trotz eines einzelnen CLI-Einstiegs intern in kleine Bausteine getrennt werden.

Empfohlene Modulgrenzen:

- CLI-Optionen und Lauf-Orchestrierung
- Registry-Discovery
- Keycloak-Inspektion
- HTTP-Checks
- lokale IAM-Checks
- Statusaggregation
- HTML-Rendering

Diese Trennung ist keine Vorab-Abstraktion, sondern notwendig, damit die Check-Logik einzeln testbar und fachlich nachvollziehbar bleibt.

### 10. Teststrategie

Die Implementierung erhält mindestens:

- Unit-Tests für Statusaggregation
- Unit-Tests für das Ergebnismodell
- Unit-Tests für den HTML-Renderer
- Mocks für Registry-, Keycloak- und DB-nahe Prüfmodule

Nicht Ziel der regulären Unit-Suite:

- ein echter Live-Audit gegen `studio`

Der Live-Lauf bleibt ein operativer manueller oder CI-naher Ausführungspfad und kein deterministischer Standardtest.

## Offene Randentscheidungen für die Implementierung

Die folgenden Punkte sind im Design bereits hinreichend eingegrenzt und müssen in der Implementierung nur noch konkretisiert, nicht neu verhandelt werden:

- ob `kcadm.sh` direkt oder über einen kleinen Keycloak-Wrapper aufgerufen wird
- ob der Report zusätzlich ein internes JSON-Nebenartefakt schreibt
- wie der exakte Dateiname des HTML-Reports lautet

Diese Entscheidungen dürfen die fachliche Prüftiefe und das Statusmodell nicht verändern.

## Erfolgskriterien

- Ein einzelner CLI-Aufruf gegen das `studio`-Profil erzeugt einen vollständigen HTML-Report unter `docs/reports/`.
- Der Lauf lädt die zu prüfenden Instanzen automatisch aus der Registry.
- Pro Instanz sind die vereinbarten Check-Kategorien und Status nachvollziehbar sichtbar.
- Fail-, Warn- und Pass-Zustände sind ohne zusätzliche Tooling-Konsole verständlich.
- Ein Operator kann den Report ohne Quellcodekontext verwenden, um problematische Instanzen gezielt zu identifizieren.
