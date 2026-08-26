# Glossar und Stichwortsammlung

| Begriff | Gesicherte Arbeitsdefinition | Redaktionell beachten |
| --- | --- | --- |
| Aktion | Fully-qualified Berechtigungskennung wie `content.update` oder `media.read`. | Sichtbare Schaltflächen und technische Action-IDs nicht vermischen. |
| App | Derzeit vorbereiteter Navigationsbereich für künftige App-Fachlogik. | Nicht als bereits funktionsfähige App-Konfiguration beschreiben. |
| Autor beziehungsweise Principal | Person oder Organisation, in deren Kontext eine Mainserver-Schreibaktion ausgeführt wird. | „Autor“ ist nicht immer mit dem angemeldeten Konto identisch. |
| Berechtigung | Erlaubnis für eine konkrete Aktion, gegebenenfalls mit Ressourcen-, Organisations- oder Datensatzbezug. | Eine Rolle ist ein Bündel, nicht die Berechtigung selbst. |
| Betroffenenanfrage | Datenschutzvorgang, zum Beispiel Auskunft, Export, Löschung, Widerspruch oder Einschränkung. | Self-Service-Sicht und administrative Fallsicht unterscheiden. |
| Content-Block | Strukturierter Abschnitt eines Inhalts mit eigenen Text- und teilweise Medienfeldern. | Nicht jeder Inhaltstyp verwendet dieselbe Blockstruktur. |
| Datenanbieter | Mainserver-Kontext, dem ein fachlicher Datensatz zugeordnet ist. | Kann von der aktuell handelnden Person oder Organisation abweichen. |
| Entwurf | Noch nicht regulär veröffentlichter Zustand. | Sichtbarkeit und Status sind je Inhaltstyp unterschiedlich modelliert. |
| Governance-Fall | IAM-Vorgang wie Rechteänderung, Delegation, Impersonation oder Rechtstext-Akzeptanz. | Das Transparenz-Cockpit ist primär eine Prüfsicht. |
| Gruppe | Instanzgebundenes Bündel von Rollen mit Mitgliedschaften und optionaler Gültigkeit. | Gruppen sind der bevorzugte Startpunkt für neue Nutzerzuweisungen. |
| Historie | Nachvollziehbare Ereignisse und Änderungen eines Datensatzes. | Häufig nur Studio-Änderungen; externe Änderungen können fehlen. |
| Inhalt | Generischer oder plugin-spezifischer redaktioneller Datensatz. | Der gemeinsame Inhaltsbereich und Fach-Editoren ergänzen sich. |
| Instanz | Mandantenbezogener Studio-Kontext mit eigener Konfiguration, Modulen und IAM-Struktur. | Plattform- und Instanzkontext in Anleitungen deutlich trennen. |
| Katalogseite | Durch stabile ID und Route im Dokumentationskatalog erfasste Studio-Seite. | Tabs und Suchparameter sind keine eigenen Katalogseiten. |
| Kategorie | Mainserver-Klassifikation für Inhalte. | Die aktuelle Kategorienseite ist schreibgeschützt. |
| Löschregel | Tenantweite oder persönliche Regel für Konto- und Inhaltslebenszyklen. | Soft-Delete, Pseudonymisierung und physisches Löschen unterscheiden. |
| Medium beziehungsweise Asset | Verwaltete Datei mit technischer Identität, Metadaten, Sichtbarkeit und Referenzen. | Upload, Registrierung, Verarbeitung und Auslieferung sind getrennte Schritte. |
| Medienreferenz | Verknüpfung eines Assets mit einem Inhalt und einer Rolle wie Teaser- oder Headerbild. | Ein gespeicherter Inhalt kann bei partiell fehlgeschlagener Referenzsynchronisation Nacharbeit benötigen. |
| Modul | Instanzbezogene Freischaltung eines Fachbereichs samt IAM-Basis. | Ein aktives Modul allein gewährt keine Fachaktion. |
| Organisation | Hierarchischer Arbeits- und Berechtigungskontext mit Mitgliedschaften und möglicher Mainserver-Anbindung. | Default-Kontext und Autoren-Policy erklären. |
| Plugin | Erweiterung, die Fachrouten, Inhaltstypen, Aktionen und Übersetzungen beitragen kann. | Nur aktivierte und zugewiesene Plugins sind im jeweiligen Kontext relevant. |
| Rechtstextversion | Sprach- und versionsbezogener Rechtstext mit Status, Zielgruppen und HTML-Inhalt. | Akzeptanzen bleiben laut Löschdialog auch beim Löschen einer Version bestehen. |
| Rolle | System-, benutzerdefinierte oder extern verwaltete Zusammenfassung von Berechtigungen. | System- und externe Rollen können schreibgeschützt sein. |
| Sichtbarkeit | Fachliche Freigabe eines Datensatzes für Ausspielung oder Nutzung. | Nicht automatisch gleichbedeutend mit „veröffentlicht“. |
| Schnittstelle | Instanzbezogene technische Anbindung, etwa Mainserver, S3, Supabase, PostgreSQL, SMTP oder Kartenservice. | Secrets werden ersetzt, nicht im Klartext angezeigt. |
| Status | Lebenszyklus- oder Verarbeitungszustand eines Datensatzes oder Jobs. | Bedeutungen immer fachbereichsspezifisch erklären. |
| Tenant | Mandantenkontext; in der Oberfläche meistens durch die aktive Instanz repräsentiert. | Begriff nur verwenden, wenn die Zielgruppe ihn versteht, sonst „Instanz“ erläutern. |
| Verarbeitungsauftrag beziehungsweise Job | Hintergrundlauf eines Plugins mit Status, Fortschritt, Runtime und Ereignishistorie. | Fachliches Ergebnis und technische Ausführung getrennt erklären. |
