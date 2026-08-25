# Offene Fragen für Produkt und Redaktion

Diese Liste enthält Punkte, die sich nicht belastbar allein aus dem aktuellen UI-Vertrag ableiten
lassen oder eine redaktionelle beziehungsweise fachliche Entscheidung benötigen. Die zugehörigen
Seitensteckbriefe bleiben dennoch verwendbar.

| Bereich | Offene Frage | Warum relevant? | Benötigte Klärung |
| --- | --- | --- | --- |
| App | Soll `app.overview` als bewusste Platzhalterseite dokumentiert oder bis zur Fachanbindung nur mit einem kurzen Statushinweis versehen werden? | Eine ausführliche Anleitung würde nicht vorhandene Funktionen suggerieren. | Produktverantwortung App |
| Medien | Welche maximale Dateigröße und vollständige Formatliste gelten in der produktiven Konfiguration? | Die UI nennt Beispieltypen, Grenzwerte können aber laufzeitabhängig sein. | Medienbetrieb und Runtime-Konfiguration |
| Medien | Für welche Zielgruppen ist `/media` gegenüber `/admin/media` der vorgesehene Einstieg? | Beide Routen verwenden dieselbe Fassade, aber die Navigationssemantik ist nicht selbsterklärend. | Produkt und IAM |
| Kategorien | In welchem führenden System und durch welche Rolle werden Kategorien aktuell geändert? | Die Studio-Seite zeigt Bearbeitungsaktionen nur deaktiviert. | Mainserver-Fachverantwortung |
| Inhalte | Welche fachliche Regel entscheidet zwischen generischem Inhalt und einem Plugin-Inhaltstyp? | Falsche Typwahl erzeugt schwer wartbare Daten. | Redaktion und Produkt |
| Nachrichten | Welche fachlichen Kriterien erlauben einen globalen Push und welche Freigabe ist organisatorisch erforderlich? | Die UI bestätigt den Versand, definiert aber keine redaktionelle Governance. | Kommunikationsverantwortung |
| Veranstaltungen | Wie sollen Änderungen an bereits veröffentlichten Terminserien redaktionell gehandhabt werden? | Technische Feldvalidierung beantwortet keine fachliche Änderungsstrategie. | Veranstaltungsredaktion |
| Projekte | Welche öffentliche Auswirkung hat der Zustand „im Studio als gelöscht markiert“ genau? | Der Löschdialog belegt keine unmittelbare physische Entfernung oder Ausspielzeit. | Mainserver- und Projektverantwortung |
| Umfragen | Welche produktiven Mainserver-Umgebungen unterstützen das Bearbeiten bereits vollständig? | Die UI kann `update_unavailable` melden. | Mainserver-Betrieb |
| Umfragen | Wann werden Moderationsaktionen für Freitexte host-seitig angebunden? | Die aktuelle Ansicht ist ausdrücklich nur lesbar. | Produkt-Roadmap, nicht als aktueller Ablauf dokumentieren |
| Abfallkalender | Welche in den Tabs angekündigten Folgefunktionen sind am Übergabe-Stichtag produktiv aktiviert? | Einzelne Übersetzungstexte nennen noch kommende Anbindungen. | Abfall-Produktverantwortung und Live-Prüfung |
| Instanzen | Welche Betriebsaktionen dürfen regulär über die Detailseite ausgeführt werden und welche sind Incident- oder Diagnosepfade? | Eine Anwenderhilfe darf keinen konkurrierenden Rollout- oder Recovery-Prozess etablieren. | Plattformbetrieb |
| Rollen | Welche Rollen dürfen kundenspezifisch erstellt werden und welche Namenskonvention gilt? | Die UI validiert technische Struktur, nicht die organisatorische Rollenarchitektur. | IAM-Governance |
| Organisationen | Welche Autoren-Policy ist für welche Organisationstypen fachlich vorgesehen? | Beide Policywerte sind technisch möglich, aber nicht fachlich zugeordnet. | IAM und Redaktion |
| Rechtstexte | Darf eine bereits gültige Rechtstextversion inhaltlich geändert werden oder muss immer eine neue Version entstehen? | Die UI bietet Bearbeiten; Compliance-Regeln können enger sein. | Recht und Compliance |
| IAM | Wo werden Governance- und Datenschutzfälle tatsächlich entschieden beziehungsweise mutiert? | Die katalogisierten Detailseiten sind aktuell reine Prüfsichten. | IAM- und Datenschutzprozess |
| Monitoring | Welche Monitoring-Inhalte gehören in die allgemeine Anwenderdokumentation und welche in eine interne Betriebsanleitung? | Technische Kennungen und Benchmarks sind für normale Redaktion nicht relevant. | Dokumentationsverantwortung und Betrieb |
| Screenshots | Welche Referenzinstanz und welche neutralen Beispieldaten dürfen für Abbildungen verwendet werden? | Screenshots dürfen keine PII, Secrets oder kundenspezifischen Daten enthalten. | Datenschutz und Redaktion |
