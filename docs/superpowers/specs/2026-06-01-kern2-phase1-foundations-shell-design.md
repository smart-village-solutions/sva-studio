# KERN-2-Migration Phase 1: Foundations und Shell

## Kontext

Das Studio besitzt bereits eine zentrale Theme-Auflösung über `apps/sva-studio-react/src/lib/theme.ts`, `apps/sva-studio-react/src/providers/theme-provider.tsx` und semantische CSS-Tokens in `apps/sva-studio-react/src/styles.css`. Damit existiert eine tragfähige technische Basis für eine visuelle Migration, ohne Routing, Zustandslogik oder Fachmodule früh anzufassen.

Ziel ist eine schrittweise Umstellung auf KERN 2. Die erste Lieferstufe soll die oberflächliche Optik des Studios sichtbar in Richtung KERN 2 bewegen, ohne die bestehende Struktur zu verändern. Header, Sidebar, Shell-Flächen und die globalen Foundations stehen im Fokus; Interaktionsmuster, Form-Logik und fachliche Seitenstrukturen bleiben vorerst stabil.

KERN 2 ist sowohl über das Figma Design Kit als auch über `@kern-ux/native` dokumentiert. Für Phase 1 dient KERN primär als visuelle und tokenbezogene Referenz. Eine unkontrollierte globale Übernahme des offiziellen KERN-CSS wird in dieser Phase bewusst vermieden, weil das Studio bereits Tailwind-, shadcn- und projektspezifische Styles kombiniert.

## Zielbild

Nach Phase 1 wirkt das Studio im Light-Theme klar wie eine KERN-2-nahe Oberfläche, obwohl Informationsarchitektur, Seitenaufbau und Fachinteraktionen unverändert bleiben. Die sichtbare Veränderung soll sich vor allem über Foundations und Shell vermitteln:

- Typografie und Schriftwirkung
- Hintergrund- und Flächenhierarchie
- Farbrollen für Navigation, Content-Flächen und Hervorhebungen
- Border-, Radius- und Shadow-Sprache
- Header- und Sidebar-Anmutung

Das Ziel ist ausdrücklich kein 1:1-Markup-Port von KERN-Komponenten. Bestehende React- und shadcn-Strukturen bleiben erhalten und werden auf KERN-2-nahe Tokens und Styles gemappt.

## Scope

### In Scope

- Umstellung der globalen Foundations in `apps/sva-studio-react/src/styles.css`
- Anpassung der Theme-Basis und Theme-Metadaten in `apps/sva-studio-react/src/lib/theme.ts`
- Beibehaltung der bestehenden Theme-Auflösung in `apps/sva-studio-react/src/providers/theme-provider.tsx`
- Visuelle Anpassung von Header, Sidebar und Shell-nahen Containerflächen
- Mapping von KERN-2-Farben, Typografie, Radien, Borders und Shadows auf bestehende semantische Studio-Tokens
- Sichtprüfung und gezielte Nachschärfung von Shell-nahen Sonderflächen, wenn sie den neuen Gesamteindruck brechen

### Out of Scope

- Umbau der Seitenstruktur, Navigationstiefe oder Informationsarchitektur
- Austausch bestehender React-Komponenten gegen KERN-HTML-Markup
- Globale, unselektierte Einbindung des gesamten KERN-CSS mit überschreibender Wirkung auf alle Komponenten
- Vollständige Migration von Buttons, Inputs, Selects, Dialogen, Tabs, Tabellen und Formularpatterns
- Plugin-spezifische Detailseiten als eigenständige Redesigns
- Verhaltensänderungen an Formularen, Dialogen oder Navigation

## Architekturentscheidungen

### 1. Bestehende Theme-Architektur bleibt der Träger der Migration

Die vorhandene Auflösung über `data-theme` und `data-theme-mode` bleibt erhalten. Phase 1 ersetzt nicht die Architektur des Theming, sondern deren visuelle Belegung. Dadurch wird das Risiko reduziert und ein sauberer Ausbau für spätere Phasen ermöglicht.

### 2. KERN 2 wird zuerst in semantische Studio-Tokens übersetzt

KERN-2-Werte werden auf bestehende semantische Rollen wie `background`, `foreground`, `card`, `popover`, `primary`, `muted`, `border`, `ring`, `sidebar` und abgeleitete Shell-Tokens gemappt. Das Studio konsumiert weiterhin semantische Tokens statt produktiver Direktwerte.

### 3. `@kern-ux/native` ist in Phase 1 Referenz, nicht automatischer Global-Reset

Die npm-Bibliothek kann für Fonts, Foundation-Abgleich und spätere Vergleichstests eingebunden werden, aber nicht als unkontrolliert globale Stilquelle. Jede tatsächliche Nutzung wird auf Kollisionen mit Tailwind/shadcn geprüft. Der Standardpfad für Phase 1 ist ein kontrolliertes Token- und Shell-Reskin im bestehenden Styling-System.

### 4. Light-Theme ist der primäre Lieferfokus

Der erste Abnahmestand fokussiert das Light-Theme. Dark-Mode bleibt architektonisch erhalten, wird aber in Phase 1 nur so weit mitgezogen, wie es für Konsistenz und Nicht-Regression nötig ist. Eine vollständige KERN-nahe Dark-Theme-Schärfung kann als Folgearbeit geplant werden.

### 5. Struktur und Verhalten bleiben bewusst stabil

Header, Sidebar und Shell dürfen visuell stark verändert werden, aber ihre funktionale Struktur bleibt bestehen. Phase 1 ist ein Reskin, kein Layout-Neuentwurf.

## Betroffene Bausteine

- `apps/sva-studio-react/src/styles.css`
- `apps/sva-studio-react/src/lib/theme.ts`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- Shell-/Root-nahe Layout-Dateien in `apps/sva-studio-react/src/`, soweit sie Flächen, Hintergründe oder Shell-Container definieren

Optional und nur bei klarer Notwendigkeit:

- einzelne app-interne UI-Helfer, wenn sie direkt die Shell-Optik brechen
- minimale Dokumentationsanpassungen zu UI-Shell-Theming und Design-Tokens

Architekturreferenz für die spätere Synchronisierung:

- `docs/architecture/08-cross-cutting-concepts.md` im Abschnitt `UI-Shell, Responsivität und Skeleton UX`

## Umsetzungsansatz

### Schritt 1: KERN-2-Foundation ableiten

- relevante KERN-2-Werte aus Figma und Dokumentation extrahieren
- Farbrollen, Schriften, Abstände, Radien und Flächenhierarchie bestimmen
- Studio-Tokens den KERN-2-Rollen eindeutig zuordnen

### Schritt 2: globale Tokens und Typografie umstellen

- CSS-Variablen in `styles.css` anpassen
- globale Schriftfamilie, Flächen- und Kontrastlogik angleichen
- bestehende Sondertokens wie `sidebar-*` oder `waste-panel-*` gegen die neue Foundation validieren

### Schritt 3: Shell reskinnen

- Header auf KERN-2-nahe Flächen- und Typografiesprache bringen
- Sidebar-Farben, aktive Zustände, Hover-Zustände, Borders und Oberflächen angleichen
- Root-Container und Shell-Hintergründe in eine konsistente KERN-2-Hierarchie überführen

### Schritt 4: Light-Theme visuell verifizieren

- Shell, Startseite und einige repräsentative Seiten auf Konsistenz prüfen
- störende Direktfarben im Shell-Umfeld gezielt beseitigen
- keine Ausweitung auf tiefe Fachflächen ohne neue Freigabe

## Risiken und Gegenmaßnahmen

### Risiko 1: Kollisionen durch KERN-CSS

Wenn `@kern-ux/native` global ungefiltert eingebunden wird, sind Konflikte mit bestehenden Tailwind-Utilities, shadcn-Komponenten und lokalen Klassen wahrscheinlich.

Gegenmaßnahme:

- keine globale Vollübernahme in Phase 1
- KERN zuerst als Referenz und nur selektiv als technische Quelle nutzen

### Risiko 2: gemischte visuelle Sprache

Die Shell kann nach KERN 2 aussehen, während innere Fachflächen noch Altbestand tragen.

Gegenmaßnahme:

- Phase 1 bewusst als Shell-/Foundation-Lieferstufe kommunizieren
- nur Shell-nahe visuelle Brüche gezielt mitziehen

### Risiko 3: Scope-Ausweitung in Shared UI Primitives

Beim Reskin taucht schnell der Wunsch auf, Buttons, Inputs oder Dialoge sofort mitzunehmen.

Gegenmaßnahme:

- klare Grenze zu Phase 2
- Änderungen an Shared Primitives nur dann, wenn sie für die Shell unmittelbar erforderlich sind

### Risiko 4: unvollständige Token-Abdeckung

Einzelne Sonderflächen können weiterhin alte projektspezifische Werte verwenden.

Gegenmaßnahme:

- nach dem Token-Swap gezielte Suche nach Direktfarben und Shell-Sonderflächen
- Restpunkte dokumentieren statt implizit mitzuschleppen

## Verifikation

Der kleinste sinnvolle Abnahmepfad für Phase 1 umfasst:

- betroffene Unit-Tests der Shell-Komponenten
- affected Unit-Tests für das React-Studio-Projekt
- visuelle Prüfung des Light-Themes in der laufenden App
- optional gezielte Typ-/Lint-Prüfung, falls Theme-Typen oder Imports geändert werden

Eine breite Vollsuite ist für diese Phase nicht der erste Schritt. Maßgeblich ist der kleinste echte Gate-Pfad für die tatsächlich betroffenen Shell-Dateien.

## Erfolgskriterien

- Das Studio wirkt im Light-Theme in Header, Sidebar und globalen Flächen klar KERN-2-nah.
- Die bestehende Seitenstruktur und Navigation bleiben unverändert.
- Theme-Auflösung über `ThemeProvider` funktioniert weiter.
- Es gibt keinen unkontrollierten globalen Stilbruch durch eine direkte KERN-CSS-Übernahme.
- Offene Reststellen außerhalb der Shell sind klar als Phase-2-Kandidaten erkennbar.

## Empfohlene Folgephasen

### Phase 2

- Shared UI Primitives auf KERN-2-nahe Styles bringen
- Buttons, Inputs, Selects, Dialoge, Tabs, Badges und Tabellen vereinheitlichen

### Phase 3

- Fachflächen und Plugin-Seiten systematisch nachziehen
- verbleibende Direktfarben und Altbestand entfernen

## Offene Punkte

- Welche Teile von `@kern-ux/native` sich gefahrlos technisch nutzen lassen, ohne globale CSS-Kollisionen auszulösen
- ob für die Typografie nur die KERN-Fonts oder zusätzlich weitere Foundation-Regeln direkt aus dem Paket übernommen werden
- ob Dark-Mode in Phase 1 nur regression-sicher bleibt oder bereits sichtbar an KERN angenähert werden soll
