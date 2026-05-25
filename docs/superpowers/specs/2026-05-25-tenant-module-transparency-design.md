# Design: Modultransparenz in Tenant-Detailansichten

Stand: `2026-05-25`

## Kontext

Die bestehende Root-Ansicht unter `/modules` ist die führende Verwaltungsstelle für Modulzuweisungen. Dort weist der Studio-Admin Module einer Instanz zu oder entzieht sie wieder. Innerhalb der Tenant- bzw. Instanzdetailseite fehlt bislang jedoch eine kompakte, lesende Übersicht darüber,

- welche global bekannten Module es gibt,
- ob sie für den aktuellen Tenant aktiviert sind,
- und wofür das jeweilige Modul fachlich steht.

Aktuell zeigt die Root-Ansicht nur getrennte Listen für zugewiesene und verfügbare Module. In der Tenant-Sicht gibt es keine vollständige Modultabelle mit aktivem/deaktiviertem Zustand und keiner pluginseitigen Nutzenbeschreibung.

## Ziele

- Die Tenant-Detailseite zeigt alle global bekannten Module in einer einheitlichen Tabelle.
- Der Status jedes Moduls ist pro Tenant transparent als `Aktiv` oder `Deaktiviert` sichtbar.
- Die Statusableitung bleibt eindeutig: `Aktiv` bedeutet, dass das Modul in der Root-Ansicht diesem Tenant zugewiesen wurde.
- Jedes Modul zeigt einen kurzen Werbetext bzw. eine Nutzenbeschreibung.
- Werbetexte werden fachlich bei den jeweiligen Plugins gepflegt und nicht in einer separaten zentralen UI-Liste dupliziert.

## Nicht-Ziele

- Kein neuer fachlicher Zustand `nicht installiert`.
- Keine zweite Aktivierungslogik innerhalb der Tenant-Sicht.
- Keine zusätzliche Persistenz für tenantlokale Modulzustände.
- Kein Umbau der Root-Modulverwaltung zu einer anderen Interaktion.

## Fachliche Entscheidung

Es gibt vorerst nur zwei relevante Zustände in der Tenant-Sicht:

1. `Aktiv`
2. `Deaktiviert`

`Aktiv` ist ein abgeleiteter Zustand und bedeutet, dass die `moduleId` des Moduls in der Root-Ansicht dem Tenant zugeordnet wurde. `Deaktiviert` bedeutet, dass das Modul global bekannt ist, für diesen Tenant aber derzeit nicht zugeordnet ist.

Ein zukünftiger Zustand wie `nicht installiert` bleibt bewusst außerhalb des aktuellen Scopes. Die Tenant-Sicht zeigt trotzdem bereits jetzt alle global bekannten Module, damit der Tenant-Bestand vollständig und vergleichbar sichtbar ist.

## Architekturentscheidung

Die bestehende Root-Ansicht `/modules` bleibt die einzige schreibende Stelle für Modulzuweisungen. Die Tenant-Detailseite erhält zusätzlich einen rein lesenden Abschnitt `Module`, der den aktuellen Zustand erklärt, aber keine konkurrierende Zuordnungslogik einführt.

Die Daten werden aus zwei vorhandenen oder naheliegenden Quellen zusammengesetzt:

1. globale Modulliste
2. `assignedModules` des aktuellen Tenants

Zusätzlich wird eine pluginnahe Metadatenquelle für Modulbeschreibungen benötigt. Diese Beschreibung gehört zum jeweiligen Plugin bzw. Modulvertrag und wird dort gepflegt, damit die fachliche Aussage beim Eigentümer des Moduls bleibt.

## UI-Design

### Tenant-Detailseite

Die Tenant-Detailseite erhält einen neuen Tabellenabschnitt `Module`.

Jede Zeile repräsentiert genau ein global bekanntes Modul. Die Tabelle zeigt mindestens diese Spalten:

- `Modul`
- `Status`
- `Werbetext`

Optional kann eine spätere `Hinweis`-Spalte ergänzt werden, falls die Ableitung des Status im UI noch expliziter erklärt werden soll. Für den aktuellen Scope ist sie nicht erforderlich.

### Statusdarstellung

- `Aktiv` wird als klarer positiver Badge dargestellt.
- `Deaktiviert` wird als neutraler oder gedämpfter Badge dargestellt.

Die Tabelle ist lesend und erklärend. Sie soll keine zweite Bedienlogik für Aktivierung oder Entzug einführen. Operatoren erkennen dort den Status und den Nutzen eines Moduls, führen Änderungen aber weiterhin über die Root-Verwaltung aus.

### Inhaltliche Ausrichtung des Werbetexts

Der Werbetext ist eine kurze fachliche Nutzenbeschreibung, kein technischer Rollen- oder Permission-Export.

Geeignet sind Formulierungen wie:

- welchen Bereich das Modul abdeckt,
- welchen Nutzen es im Tenant stiftet,
- welche redaktionelle oder operative Aufgabe es unterstützt.

Nicht geeignet sind reine Listen von Berechtigungen, Systemrollen oder internen IDs.

## Datenmodell und Quellen

### Statusableitung

Die Tenant-Tabelle rendert alle global bekannten Module. Für jedes Modul gilt:

- ist `moduleId` in `assignedModules` des aktuellen Tenants enthalten, lautet der Status `Aktiv`
- andernfalls lautet der Status `Deaktiviert`

Dafür ist keine neue Persistenz erforderlich. Die Tenant-Sicht bleibt eine direkte Ableitung aus dem bestehenden Modulzuordnungsvertrag.

### Plugin-lokale Modulbeschreibung

Die Beschreibung eines Moduls wird bei dessen Plugin abgelegt. Die UI konsumiert diese Beschreibung nur noch.

Daraus folgen diese Leitplanken:

- jedes global registrierte Modul sollte eine kurze Beschreibung mitbringen
- die Beschreibung gehört in den pluginnahen Vertrag oder in eine eng gekoppelte Plugin-Metadatenstruktur
- Root- und Tenant-Sicht sollen dieselbe fachliche Metadatenquelle verwenden, statt eigene Textbestände zu pflegen

Falls ein Modul vorübergehend noch keinen Werbetext liefert, braucht die UI einen klaren Fallback, etwa eine neutrale Platzhalterbeschreibung. Dieser Fallback ist nur technische Absicherung und kein gewünschter Dauerzustand.

## Implementierungszuschnitt

### Root-Ansicht `/modules`

Die Root-Ansicht bleibt funktional führend. Sie kann optional dieselbe pluginseitige Beschreibung ebenfalls anzeigen, muss aber für diesen Change nicht neu gedacht werden. Entscheidend ist, dass die Tenant-Sicht ihren Status aus derselben Zuweisungsquelle ableitet.

### Tenant-Detailseite

Die Detailseite des Tenants erweitert ihren Datenzuschnitt um:

- die globale Modulliste
- die pluginseitigen Beschreibungen
- die Ableitung des Aktiv-Status aus `assignedModules`

Die eigentliche Darstellung erfolgt in einem klar abgegrenzten Tabellenabschnitt, damit die Modulinformation nicht zwischen anderen Diagnoseblöcken untergeht.

## Fehlerbehandlung

- Wenn die globale Modulliste geladen werden kann, aber einzelne Module keine Beschreibung mitbringen, rendert die UI einen definierten Fallbacktext statt leerer Zellen.
- Wenn die Tenant-Details geladen werden, aber `assignedModules` fehlt oder inkonsistent ist, behandelt die UI den Status fail-closed und markiert Module nicht versehentlich als aktiv.
- Wenn die Modulmetadaten gar nicht geladen werden können, zeigt die Seite einen verständlichen Fehler- oder Degradationszustand für den Modulabschnitt.

## Tests

Die Änderung braucht mindestens folgende Abdeckung:

### UI-Tests

- alle global bekannten Module werden in der Tenant-Tabelle angezeigt
- ein zugewiesenes Modul wird als `Aktiv` gerendert
- ein nicht zugewiesenes global bekanntes Modul wird als `Deaktiviert` gerendert
- pro Modul wird der Werbetext angezeigt
- ein fehlender Werbetext rendert den definierten Fallback statt leerer Ausgabe

### Integrationsnahe Tests

- Root-Zuordnung und Tenant-Anzeige verwenden dieselbe Modul-ID-Basis
- die Tenant-Sicht erzeugt keinen eigenen schreibenden Aktivierungszustand

## Auswirkungen auf Spezifikation und Doku

Die bestehende `account-ui`-Spezifikation beschreibt bereits die Root-Modulverwaltung. Für diesen Change ist eine Ergänzung erforderlich, damit auch die lesende Modultransparenz in der Tenant-Detailseite normativ festgehalten wird.

Voraussichtlich betroffen:

- `openspec/specs/account-ui/spec.md`
- bei Architekturbezug optional die Instanz-/UI-bezogenen arc42-Abschnitte, falls der neue Tenant-Modulabschnitt dort explizit beschrieben werden soll

## Risiken und Trade-offs

### Risiko: Modulbeschreibung ohne klaren Plugin-Vertrag

Wenn Werbetexte nur ad hoc in der UI ergänzt werden, entsteht erneut eine doppelte Wahrheitsquelle. Deshalb gehört die Beschreibung bewusst in das jeweilige Plugin oder in dessen modulnahe Registry-Metadaten.

### Risiko: Statusbegriff wird missverstanden

`Deaktiviert` bedeutet in diesem Change nicht technisch deinstalliert, sondern nur nicht dem Tenant zugeordnet. Diese Semantik muss in Text und UI konsistent bleiben.

### Trade-off: Vollständigkeit vor Kürze

Die Tenant-Sicht zeigt alle global bekannten Module, nicht nur die aktiven. Das macht die Tabelle länger, erhöht aber die Transparenz und Vergleichbarkeit zwischen Tenants deutlich.

## Empfohlener Umsetzungsweg

1. pluginnahe Modulmetadaten um eine Beschreibung erweitern
2. Tenant-Detailmodell um die vollständige Modulliste und Statusableitung ergänzen
3. Tabellenabschnitt in der Tenant-Detailseite implementieren
4. bestehende Tests erweitern und neue UI-Tests für Status und Werbetexte ergänzen
5. `account-ui`-OpenSpec normativ ergänzen
