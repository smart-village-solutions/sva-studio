## MODIFIED Requirements

### Requirement: Gruppenverwaltung im Admin-Bereich

Das System MUST im Admin-Bereich eine Oberfläche zur Verwaltung instanzgebundener Gruppen bereitstellen.

#### Scenario: Administrator verwaltet Gruppen

- **WENN** ein berechtigter Administrator die Gruppenverwaltung öffnet
- **DANN** kann er Gruppen anlegen, bearbeiten, deaktivieren und löschen
- **UND** sieht pro Gruppe mindestens Name, Beschreibung, Typ, Mitgliederzahl (`t('admin.groups.memberCount_one')` / `t('admin.groups.memberCount_other')`) und zugewiesene Rechtebündel
- **UND** alle sichtbaren Labels, Statuswerte und Aktionsbeschriftungen werden ausschließlich über i18n-Keys bezogen (kein Hardcoded-Text; Namespace `admin.groups.*`)
- **UND** die Listenansicht ist als semantische `<table>` mit `<caption>`, `scope`-Attributen auf Spaltenköpfen implementiert
- **UND** bei mehr als 50 Gruppen ist eine Paginierung vorhanden; die Liste ist über ein zugängliches Suchfeld filterbar (`role="search"`, `<label>`)
- **UND** die aktive Sortierung ist per `aria-sort` auf dem Spalten-`<th>` angezeigt
- **UND** destruktive Aktionen (Löschen) lösen einen Bestätigungsdialog mit `role="dialog"` und Focus-Trap aus

#### Scenario: Gruppenzuweisung zu Benutzerkonten

- **WENN** ein Administrator ein Benutzerkonto bearbeitet
- **DANN** kann er Gruppenmitgliedschaften zuweisen oder entziehen
- **UND** die UI zeigt bestehende Gruppenmitgliedschaften samt Gültigkeit und Herkunft korrekt an
- **UND** alle Formular-Labels sind über `<label>`-Elemente programmatisch verknüpft

#### Scenario: Gruppenansicht zeigt Rollenbündel und Mitgliedschaften gemeinsam

- **WENN** ein Administrator die Detailansicht einer Gruppe öffnet
- **DANN** sieht er mindestens Stammdaten, zugewiesene Rollen, aktuelle Mitglieder und Gültigkeitsinformationen in einem konsistenten Arbeitsbereich
- **UND** deaktivierte oder gelöschte Gruppen werden eindeutig als nicht wirksam markiert

### Requirement: Sichtbare Gruppenherkunft in IAM-Transparenzdaten

Das System MUST gruppenbasierte Herkunft von Berechtigungen in den relevanten IAM-Ansichten sichtbar machen.

#### Scenario: Effektive Berechtigung stammt aus einer Gruppe

- **WENN** eine effektive Berechtigung eines Benutzers aus einer Gruppenmitgliedschaft stammt
- **DANN** zeigt die UI diese Herkunft explizit als lesbaren Namen direkt in der Listenansicht an (z. B. „Gruppe: Presseteam") — ohne zusätzlichen Klick oder Hover
- **UND** Herkunftsbeschriftungen verwenden lesbare Namen statt interner IDs
- **UND** falls Tooltip-Darstellung genutzt wird, ist diese per Tastatur erreichbar (`role="tooltip"`, `aria-describedby`)

#### Scenario: Rollen- und Rechteansicht verdichtet Mehrfachherkunft nachvollziehbar

- **WENN** eine effektive Berechtigung gleichzeitig aus direkter Rolle und aus einer oder mehreren Gruppen stammt
- **DANN** zeigt die UI die Berechtigung nur einmal als fachliches Ergebnis
- **UND** listet die gesamte Herkunft in lesbarer Form nach Quelle auf
- **UND** direkte Rollen- und Gruppenherkunft bleiben visuell unterscheidbar

## ADDED Requirements

### Requirement: Blockierender Rechtstext-Akzeptanzflow

Das System MUST im Frontend einen blockierenden Akzeptanzflow für offene Pflicht-Rechtstexte bereitstellen.

#### Scenario: Nutzer landet nach Login im Akzeptanz-Interstitial

- **WENN** ein Nutzer mit offener Pflicht-Akzeptanz die Anwendung öffnet oder nach dem Login zurückkehrt
- **DANN** sieht er einen dedizierten Akzeptanzscreen vor allen geschützten Fachansichten
- **UND** reguläre Navigation, Deep-Links und geschützte Admin-Routen bleiben bis zur Entscheidung gesperrt
- **UND** der Interstitial-Container hat `role="dialog"`, `aria-modal="true"`, `aria-labelledby` und `aria-describedby`
- **UND** der Fokus wird beim Erscheinen auf den Heading-Knoten des Dialogs gesetzt (Focus-Trap bleibt bis zur Entscheidung aktiv)
- **UND** ESC schließt den Dialog **nicht** (blockierender Pflichtflow ist kein schließbares Modal)
- **UND** eine `aria-live="assertive"`-Region kündigt den Übergang nach Akzeptanz an

#### Scenario: Rechtstext-Akzeptanz ist barrierefrei und eindeutig

- **WENN** der Akzeptanzscreen angezeigt wird
- **DANN** sind Version, Gültigkeit, Pflichtcharakter und die auslösbare Aktion eindeutig sichtbar
- **UND** der Flow ist vollständig tastatur- und screenreader-bedienbar (WCAG 2.1 AA)
- **UND** alle UI-Texte (Buttons, Hinweise, Statuszeilen) verwenden ausschließlich i18n-Keys aus dem Namespace `legalTexts.acceptance.*`
- **UND** der rechtliche Inhalt des Rechtstexts selbst wird über die Content-API geliefert und ist kein i18n-Key

#### Scenario: Nutzer lehnt Rechtstext ab oder verlässt den Flow ohne Entscheidung

- **WENN** ein Nutzer den Rechtstext ablehnt oder den Akzeptanzscreen ohne Entscheidung verlässt (Tab schließen, Browser-Back)
- **DANN** wird die Session beendet (Logout) und der Nutzer landet auf der Login-Seite mit einem lokalisierten, erklärenden Hinweis (`t('legalTexts.acceptance.status.rejected')`)
- **UND** es gibt keine Endlosschleife und keinen stillen Fehlzustand

#### Scenario: Akzeptanz-Endpunkt antwortet mit Fehler

- **WENN** der Nutzer die Akzeptanz bestätigt und der Server einen Fehler zurückgibt
- **DANN** zeigt die UI eine programmatisch verknüpfte Fehlermeldung über `role="alert"`
- **UND** der Fokus wird auf die Fehlermeldung gesetzt
- **UND** eine Retry-Aktion ist per Tastatur erreichbar
- **UND** der blockierende Zustand bleibt bestehen (kein impliziter Durchlass bei Fehler)
- **UND** alle Fehlermeldungen verwenden i18n-Keys (`t('legalTexts.acceptance.errors.submitFailed')`, `t('legalTexts.acceptance.errors.versionExpired')`)

#### Scenario: Rückkehr nach Akzeptanz zur ursprünglichen Route

- **WENN** der Nutzer nach erfolgreicher Akzeptanz weitergeleitet wird
- **DANN** landet er auf der ursprünglich aufgerufenen Route (Deep-Link-Preservation via Session-State)
- **UND** nach der Weiterleitung wird der Fokus auf den Seitenbereich der Zielroute gesetzt

### Requirement: Admin-Oberfläche für Rechtstext-Nachweise

Das System MUST Administratoren eine explizite UI für Nachweis, Filterung und Export von Rechtstext-Akzeptanzen bereitstellen.

#### Scenario: Admin exportiert Akzeptanznachweise

- **WENN** ein berechtigter Administrator (mit Permission `legal-consents:export`) die Rechtstext-Verwaltung unter `/admin/iam/legal-texts` öffnet
- **DANN** kann er Akzeptanzen nach Benutzer, Text, Version und Zeitraum filtern
- **UND** sieht vor dem Export eine Vorschau mit Trefferanzahl und Spaltenübersicht
- **UND** wählt das Exportformat (JSON oder CSV)
- **UND** erhält nach dem Export eine barrierefreie Statusankündigung per `aria-live="polite"` (z. B. „Export als CSV gestartet.")
- **UND** alle Tabellenspalten-Überschriften und Filterbezeichner verwenden i18n-Keys (`t('legalTexts.audit.columns.*')`)

#### Scenario: Nachweis-Tabelle ist barrierefrei

- **WENN** die Nachweistabelle angezeigt wird
- **DANN** ist sie als semantische `<table>` mit `<caption>`, `<th scope="col">` für Spalten und `<th scope="row">` für Zeilenidentifikatoren implementiert
- **UND** aktive Sortierung ist per `aria-sort` kommuniziert
- **UND** leere Filterergebnisse werden programmatisch angekündigt

#### Scenario: Unberechtigter Nutzer sieht keine Nachweisdaten

- **WENN** ein Nutzer ohne die Permission `legal-consents:export` eine Nachweis- oder Exportansicht aufruft
- **DANN** werden keine sensitiven Akzeptanzdaten offengelegt
- **UND** die UI zeigt einen sicheren verweigerten Zustand
