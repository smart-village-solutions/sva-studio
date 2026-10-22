# ADR-069: Filerobot-Bildeditor mit begrenzter Accessibility-Abweichung

**Status:** Accepted
**Entscheidungsdatum:** 2026-10-22
**Entschieden durch:** Projektverantwortlicher, ausdrückliche Risikoakzeptanz im Medienkonzept

## Kontext

Die Medienverwaltung soll einen vollständigen, nicht destruktiven Bildeditor einschließlich Text, Markierungen, Filtern und wiederherstellbarem Bearbeitungszustand erhalten. Die technische Vorprüfung von `react-filerobot-image-editor` 5.0.0-beta.159 belegt React-19-Grundbetrieb und einen repräsentativen Export-/Wiederladeablauf. Sie findet jedoch nicht fokussierbare Werkzeugbereiche sowie fehlende ausreichende zugängliche Bedienwege für Canvas-Objekte. Vollständige Tastatur- und Screenreaderbedienung ist damit nicht gegeben beziehungsweise nicht nachgewiesen.

Die verbindliche Studio-Zielsetzung ist WCAG 2.1 AA. Eine vollständige Nachrüstung des spezialisierten Editors könnte einen eigenen Objekteditor oder einen gepflegten Fork erfordern. Der Projektverantwortliche akzeptiert ausdrücklich, dass dieser Teil nicht barrierefrei ist, um den vollständigen redaktionellen Funktionsumfang ohne solche Zusatzentwicklung zu integrieren.

## Entscheidung

- Filerobot ist für den vereinbarten Medieneditor als Integrationsweg akzeptiert. Die dokumentierten Accessibility-Lücken der spezialisierten Editoroberfläche werden bewusst in Kauf genommen und sind für sich kein Integrationsblocker mehr.
- Die Ausnahme umfasst Filerobots eigene Werkzeugnavigation, Werkzeug-/Objektbedienung und Canvas-Arbeitsfläche innerhalb der hostseitigen Medienintegration, in Mediathek und gemeinsamem Picker. Sie ist keine pauschale Ausnahme für die gesamte Medienverwaltung oder für andere Plugins.
- Studio-eigene Dialograhmen, Fokusführung beim Öffnen und Schließen, Metadatenformulare, Status-/Fehlermeldungen, Variantenprüfung und Abschlussaktionen behalten ihre bestehenden Accessibility-Anforderungen. Der normale Weg zum Auswählen, Hochladen und Verwenden eines unverändert übernommenen Bildes bleibt ohne Öffnen des Spezialeditors verfügbar. Eine gleichwertige barrierefreie Bildbearbeitung wird damit nicht behauptet.
- Die spezialisierten Filerobot-Controls dürfen innerhalb dieser Grenze bestehen; daraus entsteht keine zweite allgemeine Studio-Komponentenbibliothek. Theme-Anpassung und vollständige de/en-Übersetzung werden über vorhandene Konfiguration und Studio-Ressourcen umgesetzt. Es gibt keinen eigenen Accessibility-Adapter, parallelen Objekteditor oder Fork zur vollständigen Nachrüstung.
- Die Abweichung wird bei der Umsetzung im vorhandenen Accessibility Statement und am Einstieg zum Editor verständlich benannt, ohne zusätzlichen Zustimmungsdialog oder Pflichtbestätigung. Formulierungsvorgabe: „Die Bildbearbeitung ist derzeit nicht vollständig mit Tastatur und Screenreader bedienbar.“ Die Verwendung des Editors wird dadurch nicht eingeschränkt.

## Grenzen der Risikoakzeptanz

Die Entscheidung ändert ausschließlich die Accessibility-Abnahme für den Spezialeditor und dokumentiert dessen begrenzte Design-System-Ausnahme. Sie hebt keine Anforderungen an Instanztrennung, Rechte, Datenschutz, Quellschutz, Scan, Quoten, Zustandsvalidierung oder sichere Speicherung auf. Sie legitimiert keine Darstellung als vollständig WCAG-/BITV-konform und ersetzt keine gegebenenfalls erforderliche rechtliche Bewertung.

Die Runtime-/Zustandskompatibilität, konkrete Versionsbindung, TypeScript-Integrationsgrenze und transitive Lizenz-/Sicherheitsprüfung bleiben erforderlich. Der externe Übersetzungsabruf bleibt mit `useBackendTranslations=false` deaktiviert. Dieses ADR ist weder ein Implementierungsnachweis noch eine Deployment-Freigabe.

## Konsequenzen

Der vollständige Editor kann ohne einen vorgeschalteten Library-Wechsel oder eine große eigene Accessibility-Nachrüstung eingeplant werden. Menschen, die auf Tastatur oder Screenreader angewiesen sind, können die spezialisierten Bearbeitungsfunktionen nicht zuverlässig vollständig nutzen. Diese Einschränkung wird offen dokumentiert; bestehende zugängliche Auswahl- und Metadatenwege werden nicht verschlechtert.

Einfache unterstützte Verbesserungen bei Beschriftung, Fokus oder Kontrast dürfen in der regulären Integration erfolgen. Eine umfassende Nachrüstung ist keine Voraussetzung dieses Lieferumfangs. Bei einem ohnehin anstehenden Editorupdate oder einem konkreten Nutzungsproblem wird die bekannte Einschränkung erneut geprüft; es entsteht kein zusätzlicher Prüfservice, Zeitplan oder verpflichtender Ersatzpfad.

## Alternativen

- **Anderen vollständigen Editor wählen:** Könnte bessere zugängliche Bedienung ermöglichen, ist aber für den aktuellen Umfang nicht technisch nachgewiesen und wird durch die ausdrückliche Risikoakzeptanz nicht vorab verlangt.
- **Nur einen kleinen Cropper integrieren:** Würde den freigegebenen vollständigen Funktionsumfang reduzieren und wird deshalb nicht gewählt.
- **Filerobot vollständig selbst nachrüsten oder forken:** Hoher eigener Implementierungs- und Pflegeaufwand; widerspricht dem gewählten begrenzten Integrationsumfang.

## Referenzen

- [Accessibility-Richtlinie](../development/accessibility.md)
- [Querschnittliche Konzepte](../architecture/08-cross-cutting-concepts.md)
- [ADR-039: Medienmanagement als Host-Capability](./ADR-039-medienmanagement-host-capability-und-storage-vertrag.md)
- [Technische Vorprüfung](../../openspec/changes/extend-media-editor-and-metadata/library-evaluation.md)
- [Medienkonzept](../../openspec/changes/extend-media-editor-and-metadata/design.md)
