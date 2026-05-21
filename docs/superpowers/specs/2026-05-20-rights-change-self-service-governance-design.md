# Rechteänderung Self-Service mit Governance-Integration

## Ziel

Nutzer sollen unter `/account/privacy` eine Rechteänderung beantragen können,
ohne interne Rollen- oder Berechtigungsstrukturen zu sehen. Der Antrag soll
anschließend im bestehenden Governance-Cockpit unter
`/admin/iam?tab=governance` als bearbeitbarer Fall erscheinen.

## Problem

Der bestehende Governance-Pfad für Rechteänderungen ist auf administrative,
strukturierte Anträge ausgerichtet. Er setzt eine technische Sicht auf Rollen,
Zielobjekte und Freigabeparameter voraus. Für einen Self-Service-Antrag auf der
Account-Seite ist das ungeeignet, weil:

- Nutzer keine Liste möglicher Rechte sehen sollen
- Nutzer keine technischen Rollen oder Berechtigungsschlüssel auswählen sollen
- der fachliche Bedarf zuerst beschrieben und erst danach administrativ in eine
  technische Rechteänderung übersetzt werden soll

## Fachlicher Ansatz

Der Self-Service-Antrag wird nicht als separater Governance-Bereich modelliert,
sondern als vorgelagerter Einstieg in den bestehenden
`permission_change`-Workflow.

Damit bleibt die gesamte Governance-Nachvollziehbarkeit auf einem vorhandenen
Pfad:

- derselbe Governance-Tab
- derselbe Audit-/Exportkanal
- dieselbe spätere Genehmigungs- und Umsetzungslogik

Der Unterschied liegt nur im Einstiegspunkt und im initialen Statusmodell.

## UX-Design

### Account-Seite

Auf `/account/privacy` wird ein neuer Button angezeigt:

- `Rechteänderung beantragen`

Beim Klick öffnet sich ein kleiner Dialog mit:

- einer kurzen Erklärung des Zwecks
- genau einem Pflichtfeld für Freitext

Beispielhafte Feldbedeutung:

- „Welche zusätzlichen Rechte benötigen Sie und wofür?“

Nicht angezeigt werden:

- Rollenlisten
- Berechtigungslisten
- technische Rechtekennungen
- Vorschläge für interne Admin-Rollen

Nach erfolgreichem Absenden:

- Dialog schließen
- Success-Status anzeigen
- Übersicht neu laden

### Governance-Cockpit

Im Governance-Tab erscheint der Antrag als normaler `permission_change`-Fall.

Die Liste zeigt mindestens:

- Titel mit klarer Einordnung als Self-Service-Antrag
- Antragsteller
- Zeitstempel
- Status
- gekürzte fachliche Zusammenfassung

Die Detailansicht zeigt zusätzlich:

- vollständigen Freitext
- Antragsteller und Zielnutzer
- Herkunft `self_service`
- später die technische Rollen-/Rechtezuordnung durch den Admin

## Fachliches Datenmodell

### Empfohlene Erweiterungen

Der bestehende Rechteänderungsfall wird um Self-Service-Informationen ergänzt.

Neue Felder:

- `request_note`
  - Freitext des Nutzers
- `request_origin`
  - z. B. `admin` oder `self_service`

### Beteiligte Accounts

Für Self-Service-Anträge gilt:

- `requester_account_id = target_account_id`

Das bedeutet:

- der Nutzer beantragt Rechte für sich selbst
- die Governance-Ansicht kann den Fall weiterhin konsistent als
  Rechteänderungsfall behandeln

### Technische Zielabbildung

Im Intake-Zustand soll der Antrag noch keine verpflichtende technische
Rollenentscheidung erzwingen.

Das Zielbild ist:

- Nutzer beschreibt Bedarf fachlich
- Admin übersetzt diesen Bedarf später in eine konkrete Rolle oder
  Rechteänderung

Falls das bestehende Datenmodell aktuell ein sofort verpflichtendes `role_id`
erzwingt, muss für diese Self-Service-Erweiterung eine der folgenden Varianten
gewählt werden:

1. `role_id` für Intake-Fälle temporär nullable machen
2. einen separaten Intake-Datensatz einführen, der später in einen
   `permission_change_request` überführt wird

Empfohlen ist Variante 1 nur dann, wenn sie das bestehende Modell nicht
unnötig verkompliziert. Andernfalls ist ein separater Intake-Datensatz
fachlich sauberer.

## Statusmodell

### Neue oder angepasste Status

Für Self-Service-Rechteanträge wird ein vorgelagerter Status benötigt:

- `intake`

Danach folgt die administrative Bearbeitung:

- `triaged`
- `submitted`
- `approved`
- `rejected`
- `applied`

### Bedeutung der Stati

- `intake`
  - Nutzerantrag ist eingegangen, aber noch nicht technisch zugeordnet
- `triaged`
  - Admin hat den Bedarf geprüft und in eine technische Zielrichtung übersetzt
- `submitted`
  - formaler Rechteänderungsantrag liegt im regulären Governance-Pfad
- `approved`
  - freigegeben
- `rejected`
  - abgelehnt
- `applied`
  - umgesetzt

## Prozessablauf

### 1. Self-Service-Erfassung

Der Nutzer öffnet den Dialog auf `/account/privacy` und sendet einen
Freitextantrag ab.

### 2. Intake-Erzeugung

Das System erzeugt einen Governance-Fall mit:

- Typ `permission_change`
- Herkunft `self_service`
- Status `intake`
- Freitext `request_note`

### 3. Governance-Sichtbarkeit

Der Fall erscheint im bestehenden Governance-Cockpit.

### 4. Admin-Triage

Ein Admin prüft:

- fachlichen Bedarf
- Plausibilität
- organisatorischen Kontext

Danach ergänzt der Admin:

- konkrete technische Zielrolle oder Rechteänderung
- bei Bedarf Ticketbezug oder weitere Governance-Metadaten

### 5. Überführung in den regulären Workflow

Nach der Triage geht der Antrag in den bestehenden Rechteänderungsprozess über.

## Audit- und Compliance-Design

Der Antrag muss vom ersten Self-Service-Schritt an auditierbar sein.

Neue Audit-Events:

- `governance_permission_change_requested`
- `governance_permission_change_triaged`

Bestehende Folgeevents bleiben erhalten:

- `governance_permission_change_submitted`
- `governance_permission_change_approved`
- `governance_permission_change_rejected`
- `governance_permission_change_applied`

Anforderungen:

- Korrelation über `request_id` und `trace_id`
- keine Anzeige interner Rollenlisten im Self-Service
- keine unnötige Klartext-PII im Audit-Export
- Sichtbarkeit im bestehenden Governance-Compliance-Export

## API-Skizze

### Self-Service-Endpunkt

Ein schlanker neuer Endpunkt für die Account-Seite:

- `POST /iam/me/permission-change-requests`

Request:

- `requestNote: string`

Response:

- erzeugter Governance-Fall oder minimale Success-Antwort

### Governance-Read-Modell

Der bestehende Governance-Read-Pfad bleibt bestehen:

- `GET /iam/governance/workflows`

Er wird so erweitert, dass Self-Service-Intake-Fälle als
`permission_change`-Einträge sichtbar bleiben.

## Validierung

### Self-Service

- Freitext ist Pflicht
- Mindestlänge sinnvoll, aber niedrig halten
- keine Rollen-/Rechteauswahl im Formular

### Admin-Triage

- technische Zielabbildung erst ab Triage/Submission nötig
- Admin darf Intake-Fälle ablehnen oder konkretisieren

## Nicht-Ziele

Nicht Teil dieser Erweiterung:

- automatische Rollenvorschläge für Nutzer
- Anzeige eines Rechtekatalogs im Account-Bereich
- automatische Genehmigung
- neue parallele Governance-Oberfläche außerhalb des bestehenden Tabs

## Empfehlung

Die fachlich sauberste Variante ist:

- Self-Service nur für Bedarfserfassung
- bestehendes Governance-Cockpit für Bearbeitung
- Rechteänderungsfall bleibt semantisch `permission_change`
- Intake-Status und Freitext ergänzen den vorhandenen Workflow

Damit bleibt das System für Nutzer einfach, für Admins nachvollziehbar und für
Audit/Compliance konsistent.
