# Design: Inhaltsverwaltung mit Rollen-, Rechte- und Historienintegration

## Context

SVA Studio benötigt eine fachliche Inhaltsverwaltung für redaktionelle Objekte. Der gewünschte erste Umfang umfasst:

- eine Tabellenansicht für vorhandene Inhalte
- einen Einstieg zum Anlegen neuer Inhalte
- eine Erstellungs- und Bearbeitungsansicht
- ein festes Statusmodell
- eine nachvollziehbare Historie pro Inhalt
- die Kopplung an das bestehende Rollen- und Rechtemodul

Die Lösung muss in die bestehende Monorepo- und IAM-Struktur passen: fachliche Kernlogik bleibt framework-agnostisch, die UI sitzt in der React-App, und sicherheitsrelevante Entscheidungen werden serverseitig über die zentrale Autorisierung abgesichert. Zusätzlich soll `Inhalt` als Core-Baustein in die bestehende Plugin-/SDK-Architektur passen.

## Goals

- Ein verbindliches Inhaltsmodell mit klaren Pflichtfeldern definieren
- Ein stabiles Core-Modell für Inhalte definieren, das kontrolliert über das SDK erweitert werden kann
- Redakteuren eine tabellarische Übersicht und einen konsistenten Erstellungs-/Bearbeitungsflow bereitstellen
- Statuswechsel fachlich nachvollziehbar und berechtigungsabhängig machen
- Änderungen an Inhalten revisionssicher historisieren
- Rechteprüfung nicht nur in der UI, sondern über das IAM-Modul absichern

## Non-Goals

- Kein WYSIWYG-Editor für Rich-Content im ersten Schnitt
- Keine Versionierungs- oder Freigabeworkflows mit parallelen Branches
- Keine Bulk-Aktionen, Massenimporte oder Exporte im ersten Schnitt
- Keine unkontrollierte Überschreibung des Core-Inhaltskerns durch Plugins oder SDK-Erweiterungen

## Fachliches Modell

Ein Inhalt besteht im ersten Schnitt aus folgenden Feldern:

- `contentType`
- `title`
- `publishedAt`
- `createdAt`
- `updatedAt`
- `author`
- `payload`
- `status`
- `history`

`contentType` klassifiziert den fachlichen Typ des Inhalts und bestimmt, welche SDK-Erweiterungen für Validierung, UI und Zusatzlogik aktiviert werden.

### Statusmodell

Der Status ist ein kontrolliertes Enum:

- `draft`
- `in_review`
- `approved`
- `published`
- `archived`

`createdAt` und `updatedAt` werden systemseitig geführt. `author` beschreibt den fachlich sichtbaren Ersteller oder zuletzt verantwortlichen Bearbeiter; die unveränderbare technische Actor-Referenz bleibt Teil der Historie und Auditspur.

## Core- und SDK-Modell

`Inhalt` wird als kanonischer Kernvertrag modelliert. Der Kern ist stabil und enthält die gemeinsamen Metadaten, das Statusmodell, die Historie und die generischen Operationen.

### Core-Verantwortung

- kanonische Identität und Metadaten eines Inhalts
- Statusmodell und zulässige Grundoperationen
- generische Listen- und Detaildarstellung
- Audit- und Historienfähigkeit
- Basisvalidierung für Pflichtfelder und allgemeine Konsistenz

### SDK-Erweiterung

Spezielle Datentypen erweitern den Kern kontrolliert über deklarative SDK-Verträge, angelehnt an die bestehende Plugin-Architektur.

- typspezifische Payload-Validierung
- zusätzliche Formularsektionen oder Read-Only-Detailblöcke
- optionale Zusatzspalten in der Tabellenansicht
- typspezifische Aktionen oder Hinweise innerhalb der erlaubten Rechtegrenzen

Plugins oder SDK-Module dürfen den Core-Inhaltskern nicht überschreiben oder semantisch brechen. Sie erweitern ihn über wohldefinierte Extension Points.

## UI-Struktur

### 1. Tabellenansicht

Die Seite `Inhalte` dient als primärer Einstiegspunkt.

- Die Ansicht zeigt eine semantische Tabelle mit den Spalten Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status und Historie.
- Die Ansicht zeigt zusätzlich den `contentType` eines Inhalts oder macht ihn mindestens im Tabellenkontext und in der Detailansicht sichtbar.
- Der CTA `Neuer Inhalt` öffnet die Erstellungsansicht.
- Jede Tabellenzeile führt in eine Bearbeitungsansicht desselben Inhalts.
- Das Feld `payload` wird in der Tabelle kompakt dargestellt; die vollständige Bearbeitung erfolgt in der Detailansicht.
- Die Historie ist pro Inhalt über eine explizite Aktion oder einen sichtbaren Spalteneintrag erreichbar.
- Die Umsetzung verwendet die bestehenden `shadcn/ui`-Patterns und orientiert sich in Dichte, Tabellenstruktur, Statusdarstellung und Interaktionsverhalten an vorhandenen Admin-Tabellen wie der Account-Verwaltung, damit kein paralleles UI-Muster entsteht.

### 2. Erstellungs- und Bearbeitungsansicht

Die Formularansicht dient sowohl zum Anlegen als auch zum Bearbeiten.

- Bearbeitbar sind mindestens `title`, `publishedAt`, `payload` und `status`, soweit die Rolle dies erlaubt.
- Die Ansicht rendert neben den Core-Feldern optionale, vom `contentType` abhängige Erweiterungsbereiche aus dem SDK.
- `createdAt`, `updatedAt` und der initiale Autor werden vom System gesetzt und read-only dargestellt.
- `payload` wird als JSON-Eingabe mit strukturierter Validierung behandelt.
- Die Bearbeitungsansicht enthält zusätzlich eine lesbare Historie der bisherigen Änderungen.

## Rechte- und Sicherheitsmodell

Die Inhaltsverwaltung wird an die zentrale IAM-Autorisierung gekoppelt. Die UI darf Rechte nur spiegeln; die verbindliche Entscheidung erfolgt serverseitig.

### Berechtigungsaktionen

Folgende Aktionen werden als fachlich getrennte Rechte modelliert:

- `content.read`
- `content.create`
- `content.update`
- `content.submit_review`
- `content.approve`
- `content.publish`
- `content.archive`
- `content.history.read`

Typspezifische Inhalte können zusätzliche fachliche Rechte definieren, müssen aber die Core-Rechte als Basisschicht respektieren.

### Autorisierungsprinzipien

- Ohne `content.read` ist weder die Tabellenansicht noch eine Inhaltsdetailseite zugänglich.
- Benutzer mit `content.read`, aber ohne Schreibrechte, sehen Inhalte und Historie read-only.
- Statuswechsel sind berechtigungsgebunden und dürfen nicht allein durch manipulierte Client-Requests erzwungen werden.
- Die Berechtigungsprüfung wird im aktiven Instanz- und Organisationskontext ausgewertet.

## Historie und Audit

Die Historie ist kein rein dekorativer UI-Block, sondern ein fachlicher Nachweispfad. Jeder Inhalt erhält eine chronologische Änderungshistorie mit mindestens:

- Zeitpunkt
- Actor-Referenz
- ausgeführter Aktion
- betroffenem Feld oder Statuswechsel
- optionaler Kurzbegründung bzw. technischem Änderungsgrund

Die Historienansicht in der UI nutzt diese Daten, ohne interne Rohlogs offenzulegen. Audit-Daten bleiben unveränderbar; die UI konsumiert ein dafür geeignetes Read-Model.

## Validierung

- `title` ist Pflicht und darf nicht leer sein.
- `contentType` ist Pflicht und muss einem registrierten Core- oder SDK-Typ entsprechen.
- `payload` muss syntaktisch valides JSON sein.
- `status` darf nur Werte aus dem definierten Enum annehmen.
- `publishedAt` ist für den Status `published` erforderlich.
- Typspezifische Zusatzvalidierungen werden aus dem zugehörigen SDK-Typvertrag angewendet.
- Ungültige Statuswechsel oder unzulässige Schreibzugriffe werden mit strukturierten Fehlern abgewiesen.

## Architekturfolgen

- Die fachlichen DTOs und Validierungsregeln gehören in ein framework-agnostisches Kernpaket.
- Die kanonischen Inhaltstypen und Extension-Interfaces liegen in `packages/core` und werden über das SDK für spezielle Typen erweitert.
- Die React-App implementiert Tabellen-, Formular- und Historien-UI auf Basis des bestehenden Design-Systems und nutzt dafür bestehende `shadcn/ui`-Kompositionsmuster statt neuer paralleler Basis-Komponenten.
- Persistenz, serverseitige Validierung und Rechteprüfung liegen in den zuständigen Backend-/IAM-Modulen.
- Datenbankschemaänderungen für Inhalte folgen dem bestehenden Up-/Down-Migrationsmuster und müssen lokal gegen die Entwicklungsdatenbank ausführbar und verifiziert sein.
- Für Architektur- und Betriebsdokumentation sind insbesondere Building Block View, Cross-Cutting Concepts und Quality Requirements betroffen.

## Migration und lokale Verifikation

Die Inhaltsverwaltung darf keinen nur theoretischen Migrationspfad einführen. Für das Inhaltsmodell sind versionierte Schema-Migrationen mit lokalem Verifikationspfad verpflichtend.

- Jede Schemaänderung erhält eine korrespondierende Up- und Down-Migration im bestehenden Migrationsverzeichnis.
- Der lokale Migrationslauf gegen die Entwicklungsdatenbank ist vor Abschluss des Changes verpflichtend auszuführen.
- Der Verifikationspfad umfasst mindestens `up`, optional `down`, und erneut `up`, sofern der Change destruktive oder risikobehaftete Schemaänderungen enthält.
- Fehler durch nicht getestete lokale Migrationen gelten als zu verhindernder Delivery-Fehler und werden deshalb explizit im Change adressiert.

## Risiken / Trade-offs

- Das JSON-Payload-Feld ist fachlich flexibel, erhöht aber Validierungs- und UX-Anforderungen.
  - Mitigation: syntaktische Validierung im ersten Schnitt, fachliche Schema-Erweiterung später.
- Ein zu offenes Plugin-Modell könnte den Kern inkonsistent machen.
  - Mitigation: nur deklarative Erweiterungspunkte, kein Überschreiben des Core-Vertrags.
- Feingranulare Statusrechte erhöhen die Komplexität.
  - Mitigation: klare Trennung der Aktionen im IAM und explizite UI-Gates.
- Historie kann leicht mit Roh-Audit-Logs verwechselt werden.
  - Mitigation: separates Read-Model für UI-Historie, Audit-Log bleibt technische Quelle.

## Open Questions

*Keine offenen Fragen für den Proposal-Stand. Detailfragen zu Routennamen, konkreten Rollenbezeichnungen, Extension-Interfaces und registrierten Inhaltstypen werden in der Implementierung gegen die bestehenden Module konkretisiert.*
