# contextual-user-documentation Specification

## Purpose
TBD - created by archiving change add-contextual-user-documentation. Update Purpose after archive.
## Requirements
### Requirement: Alle regulären Studio-Seiten besitzen einen Dokumentationsvertrag

Das Studio MUST jede produktive, anwenderseitig sichtbare Seitenroute entweder einer stabilen Dokumentations-ID zuordnen oder mit einem zulässigen Ausschlussgrund klassifizieren. Hilfe-, Support-, Lizenz-, technische Auth-, Debug-, Redirect-, Fehler- und Not-found-Routen DÜRFEN ausgeschlossen werden.

#### Scenario: Reguläre Seite ist dokumentiert

- **WENN** eine produktive Studio-Seite für Anwender materialisiert wird
- **DANN** besitzt sie eine stabile Dokumentations-ID
- **UND** die ID ist unabhängig von konkreten Datensatz-IDs, Search-Parametern und sichtbaren Übersetzungen

#### Scenario: Nicht dokumentierbare Route ist explizit ausgeschlossen

- **WENN** eine Route ausschließlich Hilfe, Support, Lizenz, technischen Auth-Ablauf, Debugging, Redirect, Fehler oder Not-found-Verhalten bereitstellt
- **DANN** besitzt sie einen typisierten Ausschlussgrund
- **UND** sie erscheint nicht als benötigte Seite im Anwenderdokumentationskatalog

#### Scenario: Nicht-routbarer Zustand erzeugt keine eigene Seite

- **WENN** Dialoge, Tabs, Filter, Search-Parameter oder konkrete Datensätze innerhalb derselben Route wechseln
- **DANN** verwenden sie weiterhin die Dokumentations-ID der Route
- **UND** es wird keine zusätzliche Hilfeseite verlangt

### Requirement: Der Seitenkatalog wird aus den kanonischen Routenquellen erzeugt

Das Studio SHALL aus statischen UI-Routen, tatsächlich materialisierten Admin-Ressourcenrouten und freien Plugin-Routen einen deterministischen, maschinenlesbaren Seitenkatalog erzeugen. Eine app-lokale parallele URL-Mapping-Tabelle DARF NICHT die Quelle des Katalogs sein. Abweichungen zwischen dem eingecheckten Katalog und den kanonischen Routenquellen SHALL die CI sichtbar diagnostizieren, DÜRFEN aber den App-Build oder den Deploymentpfad NICHT blockieren.

#### Scenario: Initiale Liste wird erzeugt

- **WENN** der Kataloggenerator auf dem aktuellen Studio-Stand ausgeführt wird
- **DANN** enthält der Katalog jede reguläre produktive Seite genau einmal
- **UND** jeder Eintrag enthält mindestens Seiten-ID, kanonisches Route-Pattern, Seitentyp und Owner

#### Scenario: Neue Route erweitert den Katalog

- **WENN** eine neue produktive Seite in einer kanonischen Routenquelle ergänzt wird
- **DANN** verlangt der Routenvertrag eine Dokumentations-ID oder einen Ausschlussgrund
- **UND** eine dokumentierte Seite erscheint nach der Generierung im Katalog

#### Scenario: Katalog driftet von der Route-Registry

- **WENN** der eingecheckte Katalog nicht deterministisch aus den aktuellen Routenquellen reproduziert werden kann
- **DANN** meldet eine eigenständige Studio-CI-Diagnose die Abweichung sichtbar
- **UND** nennt sie fehlende Klassifizierungen oder kollidierende IDs beziehungsweise Pfade
- **UND** blockiert die Abweichung weder den App-Build noch den Deploymentpfad

### Requirement: Das separate Hilfe-Repository synchronisiert Seiten ausschließlich additiv

Das Anwenderdokumentations-Repository SHALL den Studio-Seitenkatalog einlesen und für fehlende Seiten-IDs Markdown-Dateien anlegen können. Der Sync MUST vorhandene Inhalte erhalten und DARF keine Dateien aufgrund entfallener Katalogeinträge löschen.

#### Scenario: Neue Studio-Seite wird synchronisiert

- **WENN** der Studio-Katalog eine bisher unbekannte Seiten-ID enthält
- **DANN** erzeugt der Sync eine neue Markdown-Datei beziehungsweise einen neuen Seitenentwurf
- **UND** der Entwurf enthält die stabile Seiten-ID und einen verständlichen Bearbeitungshinweis

#### Scenario: Geänderter Seitenkatalog wird auf Studio-Main gemergt

- **WENN** ein Merge beziehungsweise Push nach `sva-studio/main` den eingecheckten Seitenkatalog ändert
- **DANN** stößt der Studio-Workflow unmittelbar einen authentifizierten Sync für den exakten Studio-Commit im Hilfe-Repository an
- **UND** eröffnet oder aktualisiert das Hilfe-Repository genau einen PR mit allen fehlenden Seitenentwürfen
- **UND** löst der Sync keinen Studio-Build aus

#### Scenario: Automatischer Entwurf ist noch nicht redaktionell freigegeben

- **WENN** der Sync eine neue TODO-Seite im Automations-PR erzeugt
- **DANN** bleibt der PR ungemergt und die Seite wird noch nicht über GitHub Pages veröffentlicht
- **UND** können Redaktion oder Entwicklung Titel und Inhalt vor der Veröffentlichung prüfen

#### Scenario: Synchronisation findet keine Änderung

- **WENN** der übergebene Studio-Katalog keine unbekannte Seiten-ID und keine sonstige Katalogänderung enthält
- **DANN** erzeugt der Workflow weder Commit noch neuen PR

#### Scenario: Vorhandene Seite wird erneut synchronisiert

- **WENN** für eine Katalog-ID bereits eine Markdown-Datei existiert
- **DANN** überschreibt der Sync deren redaktionellen Inhalt nicht

#### Scenario: Katalog enthält eine frühere Seite nicht mehr

- **WENN** eine Markdown-Datei keiner aktuellen Studio-Katalog-ID mehr entspricht
- **DANN** bleibt die Datei bestehen
- **UND** der Sync führt weder Löschung noch automatische Archivierung aus

### Requirement: Anwenderdokumentation wird unabhängig als aktuelle statische Website veröffentlicht

Das separate Hilfe-Repository MUST seine Markdown-Inhalte als eigenständige statische GitHub-Pages-Website sowie als vom Studio abrufbare Ressourcen veröffentlichen. Es SHALL ausschließlich einen aktuellen Dokumentationsstand ohne Release- oder Studio-Versionsauflösung anbieten.

#### Scenario: Hilfe-Repository wird veröffentlicht

- **WENN** der GitHub-Pages-Workflow einen gültigen Stand des Hilfe-Repositories veröffentlicht
- **DANN** sind Website, Manifest und referenzierte Markdown-Ressourcen gemeinsam erreichbar
- **UND** das Manifest ordnet jede veröffentlichte Seiten-ID einem Markdown-Ziel und einer kanonischen Website-URL zu

#### Scenario: Markdown wird unabhängig geändert

- **WENN** eine Markdown-Seite geändert und das Hilfe-Repository erfolgreich veröffentlicht wird
- **DANN** kann das Studio beim nächsten Laufzeitabruf den aktualisierten Inhalt laden
- **UND** dafür ist kein Build und kein Rollout des Studio-Projekts erforderlich

#### Scenario: Weitere Inhalte werden veröffentlicht

- **WENN** das Hilfe-Repository Anleitungen, Konzepte oder FAQ ergänzt, die keiner einzelnen Studio-Route entsprechen
- **DANN** kann die eigenständige Website diese Inhalte in Navigation und Suche aufnehmen
- **UND** der Studio-Seitenkatalog muss dafür nicht erweitert werden

### Requirement: Das Studio lädt ausschließlich erlaubte aktuelle Hilfeinhalte

Das Studio MUST Hilfeinhalte über eine same-origin Server-Fassade laden, die ausschließlich bekannte Seiten-IDs und eine serverseitig konfigurierte HTTPS-Dokumentationsbasis akzeptiert. Die Fassade MUST externe Antworten zeitlich und größenmäßig begrenzen, Manifest und Ziele validieren und darf keine Studio-Anmeldedaten oder fachlichen Kontextdaten weitergeben.

#### Scenario: Bekannte Seite wird geladen

- **WENN** der Browser den Hilfeinhalt für eine bekannte Seiten-ID anfordert
- **DANN** lädt die Server-Fassade Manifest und Markdown ausschließlich relativ zur erlaubten Dokumentationsbasis
- **UND** liefert sie den validierten Markdown-Inhalt und die kanonische Website-URL zurück

#### Scenario: Anfrage enthält Studio-Kontext

- **WENN** Hilfe von einer Detailseite mit Datensatz-ID, Search-Parametern, Benutzer- und Tenant-Kontext geöffnet wird
- **DANN** übermittelt die Server-Fassade ausschließlich die abstrakte Seiten-ID an die Dokumentationsquelle
- **UND** leitet sie keine Cookies, Authorization-Header oder fachlichen Kontextdaten weiter

#### Scenario: Externes Ziel verlässt den erlaubten Origin

- **WENN** Manifest oder Redirect auf einen anderen Origin beziehungsweise ein nicht erlaubtes Protokoll verweist
- **DANN** lehnt die Fassade den Abruf fail-closed ab
- **UND** rendert der Browser den externen Inhalt nicht

#### Scenario: Dokumentationsquelle ist nicht erreichbar

- **WENN** Konfiguration fehlt, die Quelle timeoutet oder eine ungültige beziehungsweise zu große Antwort liefert
- **DANN** liefert die Fassade einen begrenzten maschinenlesbaren Fehlercode
- **UND** bleiben Studio-Route und fachliche Funktionen vollständig nutzbar

### Requirement: Externes Markdown wird als passiver Inhalt behandelt

Das Studio MUST Markdown mit einem etablierten Renderer darstellen, ohne Raw HTML, Skriptausführung oder unsichere URL-Protokolle zuzulassen. Relative Links und Medien dürfen nur gegen die validierte Dokumentationsbasis aufgelöst werden.

#### Scenario: Markdown enthält normalen Inhalt

- **WENN** eine Hilfeseite Überschriften, Absätze, Listen, Tabellen, Links oder Codeblöcke enthält
- **DANN** rendert das Overlay diese Elemente semantisch und mit Studio-Design-Tokens

#### Scenario: Markdown enthält aktiven oder unsicheren Inhalt

- **WENN** Markdown HTML, Skripte, Event-Handler, JavaScript-URLs oder nicht erlaubte Medienziele enthält
- **DANN** führt das Studio diesen Inhalt nicht aus
- **UND** unsichere Ziele werden entfernt oder als nicht interaktiv dargestellt

### Requirement: Hilfeausfälle bleiben vom Studio-Fachbetrieb getrennt

Die Anwenderdokumentation MUST eine optionale, nicht-blockierende Laufzeitabhängigkeit bleiben. Ein Fehler beim Laden oder Rendern von Hilfe DARF Navigation, Seiteninhalt, Autorisierung oder fachliche Mutationen nicht verändern.

#### Scenario: Hilfe schlägt während der Bearbeitung fehl

- **WENN** ein Anwender auf einer bearbeitbaren Seite die Hilfe öffnet und der Hilfeabruf fehlschlägt
- **DANN** zeigt ausschließlich das Overlay einen verständlichen Fehler- und Retry-Zustand
- **UND** bleiben Formularzustand und alle zulässigen Studio-Aktionen unverändert erhalten

