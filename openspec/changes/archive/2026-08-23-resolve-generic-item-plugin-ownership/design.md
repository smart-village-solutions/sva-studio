## Context

Mainserver modelliert FAQ, Kacheln und Featured Projects als `GenericItem` mit einem fachlichen `genericType`. Das Studio besitzt dafür eigenständige Fachplugins, projiziert denselben Datensatz aufgrund des technischen GenericItems-Vollzugriffs aber zusätzlich als `generic-items.generic-item`. Die gemeinsame Inhaltsübersicht kann deshalb doppelte und fachlich widersprüchliche Einträge anzeigen.

Der Change `allow-all-generic-items` hat diese Mehrfachrepräsentation bewusst zugelassen. Die neue Produktentscheidung ersetzt diesen Teil des Vertrags: Der technische Vollzugriff bleibt im eigenständigen Generic-Items-Modul erhalten, während die gemeinsame Inhaltsübersicht genau eine plugin-gesteuerte Repräsentation verwendet.

## Goals / Non-Goals

- Goals:
  - genau eine Repräsentation je Mainserver-GenericItem in der gemeinsamen Inhaltsübersicht
  - deklarative, build-time-validierte Zuständigkeit der Fachplugins
  - generischer Fallback für unbekannte oder nicht übernommene `genericType`-Werte
  - unveränderter technischer Vollzugriff im eigenständigen Generic-Items-Modul
  - identisches Verhalten im schlanken und im Legacy-Projektionsadapter
- Non-Goals:
  - keine dynamische Runtime-Registrierung von Plugins
  - keine Ableitung der Klassifikation aus Benutzerrechten
  - keine Zusammenlegung der Fachplugins mit `@sva/plugin-generic-items`
  - keine Datenmigration oder Änderung bestehender Mainserver-Datensätze

## Decisions

### Fachplugins deklarieren die Upstream-Zuständigkeit

Der bestehende Content-Type-Beitrag des Plugin-SDK erhält eine optionale, explizite Angabe für den übernommenen Mainserver-`genericType`. Die Build-time-Registry normalisiert den Wert nicht fachlich, sondern behandelt ihn als exakten, case-sensitiven Diskriminator. Leere Werte und mehrere registrierte Content-Types mit demselben Diskriminator werden beim Aufbau der Registry abgewiesen.

Das Generic-Items-Plugin registriert keinen Wildcard-Diskriminator. Es ist der definierte Fallback, wenn kein Fachplugin den konkreten Wert übernimmt.

### Ein zentraler Resolver bestimmt den Content-Type

Framework-agnostische Kernlogik erzeugt aus dem Build-time-Registry-Snapshot eine unveränderliche Zuordnung von `genericType` zu `contentType`. Für jedes GenericItem liefert sie entweder den registrierten Fach-Content-Type oder `generic-items.generic-item` zurück. Host, Projektionsadapter und Mutation-Follow-up verwenden dieselbe Zuordnung; weitere fest codierte Listen in App oder Mainserver-Adapter sind nicht zulässig.

Der Server erzeugt dieselbe Zuordnung aus kleinen, codefreien Ownership-Modulen der aktivierten Plugins. Diese Module teilen sich ihre kanonische Deklaration mit dem Content-Type-Beitrag, importieren aber weder React-Flächen noch Browser-Logger. Der Mainserver-Adapter erhält die validierte Zuordnung über seinen Host-Vertrag und akzeptiert ausschließlich Content-Types, für die er eine GenericItem-Projektion bereitstellt.

### Die gemeinsame Inhaltsübersicht klassifiziert vor der Autorisierung

Die fachliche Zuständigkeit wird unabhängig von den effektiven Benutzerrechten bestimmt. Ein durch ein Fachplugin übernommenes GenericItem darf in `/admin/content` nicht als generischer Ersatz erscheinen, wenn die Person das erforderliche Fach-Leserecht nicht besitzt. In diesem Fall ist der Datensatz dort nicht sichtbar.

Das eigenständige Generic-Items-Modul bleibt davon unberührt und darf mit `generic-items.read` weiterhin alle GenericItems direkt über den technischen GenericItems-Vertrag lesen und bearbeiten.

### Projektionszustand enthält keine dauerhaften Geschwisterrepräsentationen

Vollständige und mutationsbezogene Projektionsaktualisierungen persistieren für die gemeinsame Inhaltsübersicht nur den aufgelösten Content-Type. Bei einer Änderung des `genericType`, bei Plugin-Zuordnungsänderungen und beim Löschen werden zuvor passende Geschwisterzeilen entfernt. Ein vollständiger Refresh bereinigt bereits vorhandene doppelte Projektionszeilen ohne Datenmigration.

Progressive Aktualisierung darf keinen abgeschlossenen Snapshot mit beiden Repräsentationen veröffentlichen. Während eines laufenden Refreshs gelten die bestehenden Snapshot- und Fehlersemantiken.

Die gefilterte Pagination richtet sich nach den fachlich passenden Datensätzen und nicht nach einer einzelnen Upstream-Seite. Der Adapter scannt weitere GenericItem-Seiten, bis die angeforderte Projektionsseite gefüllt oder das Upstream-Ende erreicht ist; eine ausschließlich aus fremden Diskriminatoren bestehende Seite beendet den Snapshot nicht vorzeitig. Für Folgeseiten gibt der Adapter den erreichten Upstream-Offset zurück, damit der progressive Refresh den Scan dort fortsetzt und bereits geprüfte Seiten nicht erneut lädt.

## Alternatives Considered

### Doppelte Projektionen nur in der React-Liste ausblenden

Das wäre lokal klein, ließe aber widersprüchliche Projektionen, Zählungen und API-Ergebnisse bestehen. Außerdem könnte ein fehlendes Fachrecht nach dem vorherigen SQL-Filter unbeabsichtigt wieder die generische Zeile sichtbar machen. Diese Variante wird verworfen.

### Zuständigkeit weiterhin in einer zentralen Hardcode-Liste pflegen

Das entspricht dem heutigen Zustand und verlangt bei jedem Fachplugin Änderungen außerhalb seines Ownership-Bereichs. Es widerspricht dem Build-time-Registry-Vertrag und wird verworfen.

### Benutzerrechte bestimmen die Repräsentation

Damit könnte derselbe Datensatz abhängig von der Person einen anderen Content-Type und Detailpfad erhalten. Das erschwert Autorisierung, Historie und Support und wird verworfen.

## Risks / Trade-offs

- Eine fehlerhafte Plugin-Deklaration könnte Inhalte aus der gemeinsamen Übersicht verdrängen. Mitigation: Build-time-Validierung, Registry-Tests und generischer Fallback nur bei fehlender Zuständigkeit.
- Personen mit technischem GenericItems-Recht, aber ohne Fachrecht sehen einen übernommenen Datensatz nicht in `/admin/content`. Das ist beabsichtigt; der technische Zugriff bleibt im Generic-Items-Modul erhalten.
- Bereits persistierte Geschwisterzeilen müssen zuverlässig bereinigt werden. Mitigation: vollständige Reconciliation sowie Tests für Typwechsel, Plugin-Fallback und Delete.

## Migration Plan

1. Registry-Vertrag und eindeutige Ownership-Zuordnung einführen.
2. FAQ, Kacheln und Projekte deklarativ auf ihre bestehenden Diskriminatoren abbilden.
3. Slim-, Legacy- und Mutation-Projektion auf den zentralen Resolver umstellen.
4. Vollständigen Projektionsrefresh ausführen; dieser entfernt bestehende Geschwisterzeilen.
5. Gemeinsame Inhaltsübersicht und eigenständiges Generic-Items-Modul getrennt verifizieren.

## Open Questions

Keine.
