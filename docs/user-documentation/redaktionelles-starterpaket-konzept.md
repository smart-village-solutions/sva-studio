# Redaktionelles Starterpaket für die Anwenderdokumentation

Das ausgearbeitete Übergabematerial steht unter
[Redaktionelles Starterpaket – Inhalt](./starterpaket/README.md).

## Ziel

Das einmalige Starterpaket soll den Redakteurinnen und Redakteuren den Einstieg in die
Anwenderdokumentation erleichtern, ohne ihnen Tonalität, Didaktik oder die Ausformulierung der
Hilfetexte abzunehmen. Es liefert nachvollziehbare Produktfakten, Nutzerfragen, Seitengerüste,
Stichwörter und offene Punkte für jede im Studio-Seitenkatalog enthaltene Seite.

Die Priorisierung bestimmt ausschließlich die Bearbeitungsreihenfolge. Das Starterpaket gilt erst
als vollständig, wenn alle Seiten des zum Übergabezeitpunkt aktuellen Seitenkatalogs bearbeitet
und in der Abdeckungsmatrix erfasst sind.

## Abgrenzung

Das Starterpaket enthält keine veröffentlichungsfertige Anwenderdokumentation. Insbesondere
bleiben folgende Aufgaben bei der Redaktion:

- verständliche und zielgruppengerechte Formulierungen,
- Auswahl und Ausarbeitung didaktischer Beispiele,
- Festlegung der redaktionellen Tonalität,
- Entscheidung über Umfang und Platzierung von Screenshots,
- redaktionelle Zusammenführung und Gewichtung der gelieferten Fakten.

Der bestehende technische Vertrag für Seitenkatalog, Synchronisation und Veröffentlichung bleibt
unverändert. Das Starterpaket ist eine einmalige redaktionelle Übergabe und keine zusätzliche
Laufzeitabhängigkeit des Studios.

## Empfohlene Bestandteile

### Redaktionsorientierung

Eine kurze Einführung beschreibt Zielgruppen, typische Rollen, Berechtigungsabhängigkeiten und
die Grenzen zwischen gesicherten Produktfakten, redaktionellen Vorschlägen und offenen Fragen.
Jede Aussage im Starterpaket erhält eine der folgenden Einordnungen:

- `Produktfakt`: durch Code, Tests, Spezifikation oder verifiziertes Produktverhalten belegt,
- `Redaktioneller Hinweis`: mögliche Erklärung oder didaktische Anregung,
- `Offene Frage`: vor der Veröffentlichung fachlich zu klären,
- `Kontextabhängig`: von Rolle, Berechtigung, Instanz oder aktiviertem Plugin abhängig.

### Nutzerreisen und Dossiers

Verwandte Seiten werden nach vollständigen Arbeitsabläufen gruppiert. Ein Dossier beantwortet:

- Welches Ziel verfolgt die Anwenderin oder der Anwender?
- Wo beginnt und endet der Ablauf?
- Welche Studio-Seiten werden dabei durchlaufen?
- Welche Voraussetzungen und Berechtigungen bestehen?
- Woran ist ein erfolgreicher Abschluss erkennbar?
- Welche typischen Unsicherheiten oder Fehlerfälle gibt es?

### Seitensteckbriefe

Für jede Seiten-ID wird ein eigener Steckbrief mit mindestens folgenden Abschnitten erstellt:

1. Seiten-ID, Route, Seitentyp und technischer Owner,
2. Nutzerziel und Einordnung in einen Arbeitsablauf,
3. typische Rollen, Voraussetzungen und Berechtigungsabhängigkeiten,
4. zentrale Aktionen, Felder, Zustände und sichtbare Rückmeldungen,
5. Folgen von Speichern, Veröffentlichen, Löschen oder vergleichbaren Aktionen,
6. typische Fehler-, Leer- und Sonderzustände,
7. Leitfragen für die redaktionelle Ausarbeitung,
8. Suchbegriffe, Synonyme und mögliche Verwechslungen,
9. Vorschläge für Abbildungen und Querverweise,
10. Quellen, Evidenzstand und verbleibende offene Fragen.

Ein offener fachlicher Punkt darf die Aufnahme eines Steckbriefs nicht verhindern. Er muss jedoch
sichtbar als offene Frage mit einer zuständigen Rolle oder einem benötigten Evidenztyp erfasst
werden. Leere Abschnitte und unqualifizierte `TODO`-Platzhalter gelten nicht als Bearbeitung.

### Glossar

Das Starterpaket liefert eine Stichwortsammlung für wiederkehrende Begriffe, darunter Aktion,
Berechtigung, App, Instanz, Organisation, Benutzer, Gruppe, Rolle, Inhalt, Inhaltstyp, Status,
Kategorie, Modul, Medium, Medienverwendung, Plugin, Verarbeitungsauftrag, Schnittstelle,
Rechtstextversion, Datenschutzanfrage und IAM-Prüffall. Zu jedem Begriff werden technische
Bedeutung, sichtbare Bezeichnung, mögliche Synonyme und bekannte Verwechslungsgefahren erfasst.

### Offene-Fragen-Liste

Seitenübergreifende oder noch nicht belegte Aussagen werden separat mit Bereich, Frage,
redaktioneller Relevanz, benötigter Zuständigkeit und verfügbarem Evidenzstand geführt. Dadurch
müssen die Redakteurinnen und Redakteure technische Unsicherheiten nicht selbst entdecken.

## Bearbeitungsreihenfolge und vollständige Abdeckung

Die folgende Matrix ordnet jede aktuell katalogisierte Seite genau einem Dossier zu. `Welle` gibt
nur die empfohlene Reihenfolge an. Für die Abnahme müssen sämtliche Einträge den Status
`Steckbrief geprüft` erreichen.

| Welle | Dossier | Seiten-ID | Seitentyp | Owner |
| --- | --- | --- | --- | --- |
| 1 | Orientierung und Konto | `home.overview` | Übersicht | Host |
| 1 | Orientierung und Konto | `account.profile` | Übersicht | Host |
| 1 | Orientierung und Konto | `account.rules` | Übersicht | Host |
| 1 | Orientierung und Konto | `account.privacy` | Übersicht | Host |
| 1 | Orientierung und Konto | `account.privacy-detail` | Detail | Host |
| 1 | Inhalte verwalten | `content.list` | Liste | Host |
| 1 | Inhalte verwalten | `content.create` | Anlegen | Host |
| 1 | Inhalte verwalten | `content.detail` | Detail | Host |
| 1 | Medien verwalten | `host.media.list` | Liste | Host |
| 1 | Medien verwalten | `host.media.create` | Anlegen | Host |
| 1 | Medien verwalten | `host.media.detail` | Detail | Host |
| 1 | Medien verwalten | `media.overview` | Übersicht | Host |
| 1 | Medien verwalten | `media.usage` | Verwendung | Host |
| 2 | Kategorien und Module | `categories.overview` | Übersicht | Host |
| 2 | Kategorien und Module | `modules.overview` | Übersicht | Host |
| 2 | Redaktionelle Inhaltstypen | `cockpit-cards.content.create` | Anlegen | Plugin `cockpit-cards` |
| 2 | Redaktionelle Inhaltstypen | `cockpit-cards.content.detail` | Detail | Plugin `cockpit-cards` |
| 2 | Redaktionelle Inhaltstypen | `events.content.create` | Anlegen | Plugin `events` |
| 2 | Redaktionelle Inhaltstypen | `events.content.detail` | Detail | Plugin `events` |
| 2 | Redaktionelle Inhaltstypen | `faq.content.create` | Anlegen | Plugin `faq` |
| 2 | Redaktionelle Inhaltstypen | `faq.content.detail` | Detail | Plugin `faq` |
| 2 | Redaktionelle Inhaltstypen | `generic-items.content.create` | Anlegen | Plugin `generic-items` |
| 2 | Redaktionelle Inhaltstypen | `generic-items.content.detail` | Detail | Plugin `generic-items` |
| 2 | Redaktionelle Inhaltstypen | `news.content.create` | Anlegen | Plugin `news` |
| 2 | Redaktionelle Inhaltstypen | `news.content.detail` | Detail | Plugin `news` |
| 2 | Redaktionelle Inhaltstypen | `poi.content.create` | Anlegen | Plugin `poi` |
| 2 | Redaktionelle Inhaltstypen | `poi.content.detail` | Detail | Plugin `poi` |
| 2 | Redaktionelle Inhaltstypen | `projects.content.create` | Anlegen | Plugin `projects` |
| 2 | Redaktionelle Inhaltstypen | `projects.content.detail` | Detail | Plugin `projects` |
| 2 | Redaktionelle Inhaltstypen | `surveys.content.create` | Anlegen | Plugin `surveys` |
| 2 | Redaktionelle Inhaltstypen | `surveys.content.detail` | Detail | Plugin `surveys` |
| 2 | App und Abfallkalender | `app.overview` | Übersicht | Host |
| 2 | App und Abfallkalender | `waste-management.overview` | Übersicht | Plugin `waste-management` |
| 3 | Identitäten und Berechtigungen | `admin.users.list` | Liste | Host |
| 3 | Identitäten und Berechtigungen | `admin.users.create` | Anlegen | Host |
| 3 | Identitäten und Berechtigungen | `admin.users.detail` | Detail | Host |
| 3 | Identitäten und Berechtigungen | `admin.groups.list` | Liste | Host |
| 3 | Identitäten und Berechtigungen | `admin.groups.create` | Anlegen | Host |
| 3 | Identitäten und Berechtigungen | `admin.groups.detail` | Detail | Host |
| 3 | Identitäten und Berechtigungen | `admin.roles.list` | Liste | Host |
| 3 | Identitäten und Berechtigungen | `admin.roles.create` | Anlegen | Host |
| 3 | Identitäten und Berechtigungen | `admin.roles.detail` | Detail | Host |
| 3 | Identitäten und Berechtigungen | `admin.organizations.list` | Liste | Host |
| 3 | Identitäten und Berechtigungen | `admin.organizations.create` | Anlegen | Host |
| 3 | Identitäten und Berechtigungen | `admin.organizations.detail` | Detail | Host |
| 3 | Instanzen und Rechtstexte | `admin.instances.list` | Liste | Host |
| 3 | Instanzen und Rechtstexte | `admin.instances.create` | Anlegen | Host |
| 3 | Instanzen und Rechtstexte | `admin.instances.detail` | Detail | Host |
| 3 | Instanzen und Rechtstexte | `admin.instances.setup` | Einrichtung | Host |
| 3 | Instanzen und Rechtstexte | `admin.legal-texts.list` | Liste | Host |
| 3 | Instanzen und Rechtstexte | `admin.legal-texts.create` | Anlegen | Host |
| 3 | Instanzen und Rechtstexte | `admin.legal-texts.detail` | Detail | Host |
| 4 | Monitoring und Schnittstellen | `interfaces.overview` | Übersicht | Host |
| 4 | Monitoring und Schnittstellen | `monitoring.overview` | Übersicht | Host |
| 4 | Monitoring und Schnittstellen | `monitoring.jobs-list` | Liste | Host |
| 4 | Monitoring und Schnittstellen | `monitoring.job-detail` | Detail | Host |
| 4 | IAM und Datenschutzfälle | `admin.iam.overview` | Übersicht | Host |
| 4 | IAM und Datenschutzfälle | `admin.iam.dsr-detail` | Detail | Host |
| 4 | IAM und Datenschutzfälle | `admin.iam.governance-detail` | Detail | Host |

## Abnahmekriterien

Das Starterpaket ist übergabefähig, wenn:

1. die Abdeckungsmatrix exakt dem zum Übergabezeitpunkt eingecheckten Seitenkatalog entspricht,
2. für jede katalogisierte Seiten-ID ein nach der gemeinsamen Vorlage bearbeiteter Steckbrief
   vorhanden ist,
3. jeder Steckbrief mindestens Nutzerziel, zentrale Aktionen, redaktionelle Leitfragen,
   Stichwörter, Querverweise und Evidenzstand enthält,
4. rollen-, berechtigungs-, instanz- und pluginabhängige Aussagen als solche gekennzeichnet sind,
5. offene Punkte konkret beschrieben und einer benötigten Zuständigkeit oder Evidenz zugeordnet
   sind,
6. Nutzerreisen, Glossar und offene Fragen keine widersprüchlichen Aussagen zu den
   Seitensteckbriefen enthalten,
7. keine Seite nur mit generischem Vorlagentext, leeren Abschnitten oder unqualifizierten
   `TODO`-Markierungen als bearbeitet gilt,
8. ein abschließender Abgleich die vollständige Bearbeitung aller Katalogseiten bestätigt.

Neue Seiten, die erst nach dem vereinbarten Übergabe-Stichtag in den Katalog aufgenommen werden,
sind nicht stillschweigend Teil des einmaligen Pakets. Sie werden im Abschlussbericht als
Katalogdifferenz ausgewiesen und benötigen eine separate Entscheidung.
