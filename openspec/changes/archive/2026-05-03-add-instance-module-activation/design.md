## Context

Studio kennt heute global registrierte Plugins, aber keinen expliziten Betriebsvertrag dafuer, welche Module auf einer konkreten Instanz fachlich zugewiesen sind. Gleichzeitig wird die IAM-Basis aus `Core` und bekannten Plugin-Rechten abgeleitet, ohne dass diese Ableitung an einen instanzbezogenen Freigabestatus gebunden ist.

Die neue Funktion fuehrt deshalb einen instanzbezogenen Modulvertrag ein. Dieser Vertrag ist nicht nur UI-Metadaten, sondern eine kanonische Betriebsentscheidung mit Auswirkungen auf Routing, Actions, Integrationen und IAM-Basis.

## Goals

- Der Studio-Admin muss pro Instanz zentral und explizit steuern koennen, welche Module einer Instanz zugewiesen oder entzogen werden.
- Instanz-Operatoren haben keine Moeglichkeit, diese Zuordnung selbst zu aendern.
- Zuweisung seedet die noetige IAM-Basis fuer `Core + zugewiesene Module` in derselben Operation.
- Entzug entfernt modulbezogene Rechte hart und sperrt fachliche Nutzung fail-closed.
- Das Instanz-Cockpit muss fehlende oder driftende IAM-Basis fuer zugewiesene Module sichtbar machen und dem Studio-Admin eine direkte Reparaturaktion anbieten.

## Non-Goals

- Keine generische Plugin-Marketplace- oder Versionierungsfunktion
- Keine automatische Migration bestehender Instanzen auf einen vermuteten Modulsatz
- Keine implizite Reaktivierung ueber `featureFlags`, `mainserverConfigRef` oder technische Integrationsdaten

## Proposed Architecture

### 1. Kanonische Instanz-Modul-Zuordnung

Eine neue persistente Zuordnung beschreibt, welche Module auf einer Instanz zugewiesen sind. Diese Zuordnung ist die einzige normative Quelle fuer modulbezogene Fachfreigaben im Laufzeit- und Admin-Kontext.

Die globale Build-Time-Plugin-Registry bleibt bestehen, beschreibt aber nur, welche Module Studio grundsaetzlich kennt. Ob ein Modul auf einer bestimmten Instanz fachlich verfuegbar ist, entscheidet ausschliesslich die Instanz-Modul-Zuordnung.

### 2. Modulzuweisung als atomare Mutation

Die Zuweisungsoperation fuehrt in einer logisch atomaren Mutation aus. Technisch wird diese Mutation als einzelne Datenbank-Transaktion ueber Modulzuordnung, Permission-Upserts, Systemrollen-Upserts und `role_permissions` ausgefuehrt. Schlaegt ein Teilschritt fehl, wird die gesamte Mutation zurueckgerollt:

1. Validierung, dass das Modul global registriert ist
2. Persistente Zuweisung fuer die Zielinstanz
3. Ableitung des Sollkatalogs fuer `Core + zugewiesene Module`
4. Idempotentes Upsert von Permissions
5. Idempotentes Upsert kanonischer Systemrollen
6. Idempotentes Upsert der `role_permissions`
7. Audit-Event mit Modul, Instanz, Actor, Korrelation, Vorher-/Nachher-Zustand und Ergebnis

Dadurch bleibt der Studio-Admin-Schritt fachlich einfach: `Modul zuweisen` bedeutet sofortige betriebliche Verfuegbarkeit der Zielinstanz inklusive IAM-Basis.

### 3. Modulentzug als harte Entfernung

Der Entzug fuehrt ebenfalls eine logisch atomare Mutation in derselben Datenbank-Transaktion aus:

1. Ermittlung aller modulbezogenen Permissions
2. Entfernung der zugehoerigen `role_permissions`
3. Entfernung oder Ruecknahme systemischer Rollenerweiterungen dieses Moduls
4. Entfernung der modulbezogenen Permissions
5. Entfernen der Instanz-Modul-Zuordnung
6. Audit-Event mit Vorschau-, Vorher-/Nachher- und Ergebnisdaten

Der Entzug ist absichtlich hart. Modulrechte bleiben nicht passiv liegen, sondern werden entfernt, damit die fachliche Sperre technisch eindeutig und pruefbar ist.

### 4. Laufzeit-Gating

Host und Runtime muessen modulbezogene Nutzung fuer nicht zugewiesene Module fail-closed blockieren. Das umfasst mindestens:

- Admin-Routen und UI-Navigation
- Plugin-Actions und zugeordnete Host-Actions
- fachliche Content-Nutzung und Mainserver-Zugriffe
- IAM-Autorisierung fuer modulbezogene Permission Keys

Die globale Plugin-Registry bleibt fuer Build und Shell-Navigation relevant, aber jede instanzbezogene Nutzungsentscheidung muss zusaetzlich den Zuweisungsstatus pruefen.

### 4.1 Kanonischer Vertrag fuer modulbezogene IAM-Artefakte

Jedes Plugin, das modulbezogene Permissions oder Systemrollen in die IAM-Basis einbringt, muss diese Artefakte ueber einen kanonischen Plugin-Vertrag im `plugin-sdk` deklarieren. Dieser Vertrag definiert mindestens:

- Modul-ID
- deklarierte Permission Keys
- deklarierte kanonische Systemrollen
- deklarierte `role_permissions`

Die Soll-Ableitung fuer `Core + zugewiesene Module` darf ausschliesslich auf diesem Vertrag und nicht auf impliziten Ableitungen aus Laufzeitdaten beruhen.

### 5. Cockpit und Reparaturpfad

Das Instanz-Cockpit zeigt einen expliziten Betriebsbefund `IAM-Basis zugewiesener Module` an. Dieser Befund ist fuer den Studio-Admin auf der Instanz-Detailseite sichtbar und wird aus dem Soll-Ist-Vergleich von:

- Core-Basis
- aktiven Modulen
- vorhandenen Permissions
- vorhandenen Systemrollen
- vorhandenen `role_permissions`

abgeleitet.

Wenn der Sollstand fuer zugewiesene Module nicht erreicht ist, zeigt das Cockpit:

- einen degradierten Befund mit erklaerender Summary
- einen Eintrag in der `Anomaly Queue`
- eine direkte Reparaturaktion `Berechtigungen und Systemrollen neu seeden` (nur fuer den Studio-Admin sichtbar und ausfuehrbar)

### 6. UI-Schnitt

Die Modulverwaltung ist ein zentraler Bereich auf Studio-Root-Ebene, zugaenglich ausschliesslich fuer den Studio-Admin. Von dort werden Instanzen Module zugewiesen oder entzogen. Eine Selbststeuerung durch Instanz-Operatoren ist nicht vorgesehen.

Die Instanz-Detailseite bleibt das Cockpit fuer Betriebsbefunde und Folgeaktionen des Studio-Admins.

Der zentrale Bereich `Module` auf Studio-Root-Ebene braucht mindestens:

- Liste verfuegbarer global registrierter Module
- Pro Modul: Liste der Instanzen, denen es zugewiesen ist
- Zuweisung und Entzug von Modulen zu einer oder mehreren Instanzen
- Vorschau betroffener Rechte und Rollen vor Entzug
- Auditierbare Ergebnisrueckmeldung

## Audit Contract

Jede Zuweisungs-, Entzugs- und Reseed-Mutation schreibt ein Audit-Event mit einem normativen Mindestumfang:

- `instanceId`
- `moduleId` falls modulbezogen
- `actor.userId` als technische ID
- `actor.role` oder gleichwertiger technischer Kontext
- `correlationId`
- `before` und `after` fuer den Modulsatz der Instanz
- `outcome` (`success`, `rejected`, `failed`)

Personenbezogene Klardaten wie Name oder E-Mail duerfen nicht Teil dieses Audit-Events sein.

## Data and Contract Changes

- Neue persistente Instanz-Modul-Zuordnung
- Erweiterung des Instanz-Detail-Read-Models um zugewiesene Module und IAM-Baseline-Befund
- Neue Mutationen:
  - Modul zuweisen
  - Modul entziehen
  - IAM-Basis zugewiesener Module neu seeden
- Kanonischer Plugin-Vertrag im `plugin-sdk` fuer modulbezogene IAM-Artefakte

## Risks

### 1. Harter Entzug kann bestehende Betriebsrollen entwerten

Das ist fachlich gewollt, aber betriebsrelevant. Deshalb braucht der Entzug eine Vorschau der betroffenen Rollen und Permissions sowie eine explizite Bestaetigung.

### 2. Doppelte Aktivierungsquellen

Wenn `featureFlags`, Integrationsdaten oder Plugin-Metadaten als zweite implizite Freigabequelle weiterwirken, wird das Modell inkonsistent. Deshalb muss die neue Instanz-Modul-Zuordnung kanonisch und exklusiv fuer die Fachfreigabe sein.

### 3. Zu grobe Modulgrenzen

Falls ein Modul mehrere Content-Typen, Routen und Integrationen kapselt, muss seine Permission- und Rollenableitung sauber namespaced bleiben. Die Ableitung darf keine nicht-modulbezogenen Core-Rechte hart entfernen.

## Testing Strategy

- Repository- und Service-Tests fuer:
  - idempotente Modulzuweisung
  - idempotentes IAM-Baseline-Seeding
  - harter Modulentzug
- Routing- und Authorization-Tests fuer fail-closed Verhalten nicht zugewiesener Module
- UI-Tests fuer:
  - Modulbereich
  - Cockpit-Befund `IAM-Basis zugewiesener Module`
  - Reparaturaktion
