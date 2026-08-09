## Context

Normale Speicheraktionen besitzen mit dem jeweiligen Formular, Bereich und Speichern-Button bereits einen eindeutigen Rückmeldungskontext. Erfolg soll dort ruhig und unmittelbar erscheinen; Fehler sollen am Ort des Problems deutlich, persistent und handlungsorientiert bleiben.

Die vorhandene Architektur bietet dafür bereits die richtige Grenze:

- `@sva/studio-ui-react` stellt Host und Plugins gemeinsame UI-Primitives bereit.
- Formularvalidierung und Fehlermapping bleiben im jeweiligen Host- oder Plugin-Flow.
- `@sva/plugin-sdk` beschreibt Plugin-Beiträge, wird für normale Save-UI aber nicht benötigt.
- Die Layout-Shell ist nicht an kontextgebundenem Speicherfeedback beteiligt.

## Goals / Non-Goals

- Goals:
  - verbindliche Save-Zustände und einheitliches Timing für Host und Plugins
  - feldnahe Validierung und optionale verlinkte Fehlerzusammenfassung
  - persistente technische Fehler mit konkreter Folgeaktion
  - zugängliche Rückmeldung ohne Toast, Modal oder Fokusverlust
  - sicherer Create-Übergang auf die neu erzeugte Detailseite
  - kleine, wiederverwendbare UI-Primitives ohne spekulative Plattformschichten
- Non-Goals:
  - kein generisches Action-Outcome-Modell in `@sva/core`
  - keine Feedback-Klassen oder Feedback-Registry in `@sva/plugin-sdk`
  - keine globale Notification-Surface in der Layout-Shell
  - keine Standardisierung von Delete/Undo, Bestätigungen, Jobs oder Progress in diesem Change

## Decisions

### Decision: `@sva/studio-ui-react` besitzt die Save-UX

Der gemeinsame Vertrag wird als React-UI-Primitive umgesetzt. `@sva/core` erhält keine Texte, Timer oder React-Zustände. Ein framework-agnostischer Reducer wird erst eingeführt, wenn mindestens ein weiterer, nicht auf React basierender Consumer einen belegten Bedarf hat.

Der Save-Button akzeptiert einen kleinen kontrollierten Zustand:

```ts
type StudioSaveStatus = 'idle' | 'saving' | 'saved';
```

Fehler sind bewusst kein Buttonzustand. Nach einem fehlgeschlagenen Submit kehrt der Button zu `idle` zurück, während der Fehler persistent im Formular oder betroffenen Bereich dargestellt wird.

### Decision: Feste Zustände und ein zentrales Zwei-Sekunden-Timing

Der Button bildet den Save-Lifecycle wie folgt ab:

- `idle`: `Speichern`
- `saving`: `Wird gespeichert…`; weitere Submits sind deaktiviert
- `saved`: sichtbares Check-Icon und `Gespeichert`

`saved` bleibt genau zwei Sekunden sichtbar. Eine neue Formulareingabe beendet den Erfolgszustand sofort. Ein neuer Submit verwirft einen noch laufenden Erfolgs-Timer. Beim Unmount werden Timer bereinigt. Veraltete Request-Abschlüsse dürfen einen neueren Submit-Zustand nicht überschreiben.

Die Dauer ist ein zentraler Studio-Standard und kein pro Plugin konfigurierbares Verhalten. Übersetzte Labels werden als Props oder über einen bestehenden Host-/Plugin-Übersetzungskontext geliefert; `@sva/studio-ui-react` erhält keine Abhängigkeit auf ein bestimmtes i18n-System.

### Decision: Erfolg wird am Button und zugänglich angekündigt

Der visuelle Erfolgszustand bleibt am Speichern-Button. Zusätzlich wird die Statusänderung über eine nicht blockierende höfliche Live-Region angekündigt, da eine Änderung des fokussierten Button-Labels allein nicht in allen Assistenztechnologien zuverlässig angesagt wird.

Der Erfolg verschiebt keinen Fokus. Das Check-Icon ist dekorativ und für Assistenztechnologien verborgen. Eine stabile Mindestbreite verhindert Layoutsprünge zwischen den drei Labels.

### Decision: Validierungsfehler und technische Fehler bleiben getrennt

Client- und serverseitig auf konkrete Felder abbildbare Validierungsfehler werden über die bestehenden `StudioField`- und Formular-Bridge-Primitives direkt am Feld ausgegeben. Bei mehreren Fehlern darf oberhalb des Formulars zusätzlich eine Zusammenfassung erscheinen, deren Einträge die jeweiligen Felder fokussierbar adressieren.

Technische, API- und Serverfehler verwenden eine persistente Formular- oder Bereichsmeldung mit `role="alert"`. Sie verschwindet nicht per Timer. Soweit die Wiederholung fachlich sicher ist, enthält sie eine konkrete Aktion wie `Erneut versuchen`. Die Meldung wird erst nach erfolgreicher Wiederholung, einer expliziten fachlich zulässigen Nutzeraktion oder beim Verlassen des Kontexts entfernt.

Ein neuer Submit darf eine bestehende technische Fehlermeldung nicht vorsorglich ausblenden. Während des Retry darf sie als bestehender Fehler sichtbar bleiben oder eindeutig als erneuter Versuch gekennzeichnet werden; erst ein erfolgreicher Abschluss entfernt sie.

### Decision: Partielle Ergebnisse sind kein vollständiger Save-Erfolg

Wenn der fachliche Datensatz gespeichert wurde, ein erforderlicher Folgeschritt aber fehlschlägt, wird der Gesamtvorgang nicht als `saved` dargestellt. Die persistente Meldung beschreibt den partiellen Zustand konkret und bietet eine idempotente, auf den fehlgeschlagenen Teilschritt begrenzte Wiederholungsaktion, soweit der jeweilige Vertrag dies unterstützt.

Die Wiederholung darf den bereits erfolgreichen Primärwrite nicht unbeabsichtigt erneut ausführen. Ist eine sichere Wiederholung nicht möglich, beschreibt die Meldung stattdessen die nächste sichere Handlung.

### Decision: Create wechselt mit transientem Erfolg auf die Detailroute

Nach erfolgreicher Anlage navigiert der Flow auf die kanonische Detailroute des neu erzeugten Datensatzes. Der Zielscreen übernimmt einmalig den Zustand `saved` und zeigt dort für zwei Sekunden `✓ Gespeichert`.

Die Übergabe erfolgt transient und typsicher. Sie wird nicht in Search-Params, dem Datensatz oder einem langlebigen globalen Store persistiert. Die Zielroute konsumiert den Zustand einmalig, sodass Reload, Zurücknavigation und späteres erneutes Öffnen keinen alten Erfolg anzeigen. Datensatz-ID und transienter Erfolgsbezug müssen übereinstimmen; fremde oder veraltete Zustände werden ignoriert.

### Decision: Toasts und Dialoge sind keine Save-Surfaces

Normale Create- und Update-Ergebnisse verwenden keine Toasts. Modals und Overlays werden nicht für Erfolg oder gewöhnliche Fehler geöffnet. Sie bleiben tatsächlichen Entscheidungen vorbehalten, beispielsweise Versionskonflikten oder potenziell destruktiven Aktionen.

Kontextlose Aktionen wie Kopieren, Exportstart oder Duplizieren sind nicht Teil dieses Save-Vertrags. Ein späterer globaler Rückmeldungspfad muss separat spezifiziert werden, falls dafür ein belastbarer Bedarf besteht.

### Decision: Plugins liefern Fachsemantik, der Host liefert Verhaltenskonsistenz

Host- und Plugin-Formulare verantworten weiterhin:

- Zod-/Formularvalidierung und Feldzuordnung
- die eigentliche Mutation
- fachliche Übersetzung technischer Fehler
- sichere Retry-Funktionen
- Dirty- und Reset-Semantik des konkreten Formulars

Sie führen keine eigenen Save-State-Hooks, Timer, Basis-Buttons, globalen Toast-Stacks oder Feedback-Renderer ein. Die gemeinsame Darstellung und Accessibility liegen in `@sva/studio-ui-react`.

## PR-Schnitt und Migration

### PR 1: Foundation und zwei Referenzflüsse

PR 1 ist unabhängig review- und auslieferbar und umfasst:

1. gemeinsame Save-Button- und persistente Fehler-Primitives in `@sva/studio-ui-react`
2. Migration von `/interfaces` als Host-Referenzfluss
3. Migration des News-Editors als Plugin-Referenzfluss
4. Create-zu-Detail-Übergang im News-Flow
5. Unit-, Komponenten-, Integrations- und Accessibility-Tests
6. Dokumentation des Patterns und Aktualisierung der betroffenen arc42-Abschnitte

PR 1 führt keine Core-, Plugin-SDK-, Plugin-Registry- oder Shell-Erweiterung ein.

### Spätere PRs in diesem Change

Weitere Host- und Plugin-Formulare werden anhand der Formular-Migrationsinventur in kleinen fachlich zusammenhängenden PRs migriert. Jeder PR entfernt dabei ersetzte Save-Erfolgsmeldungen oder Save-Toasts im bearbeiteten Scope und weist die relevanten Zustands-, Fehler- und Accessibility-Tests nach.

Delete/Undo und blockierende Bestätigungen liegen in `standardize-destructive-action-feedback`, globale kontextlose Rückmeldungen in `add-contextless-action-feedback` sowie Progress- und Job-Feedback in `standardize-plugin-operation-feedback`. Diese Themen gehören nicht zu den Save-Migrations-PRs und besitzen jeweils eine separate Design- und Implementierungsfreigabe.

## Risks / Trade-offs

- Risiko: Ein zentraler Button löst nicht automatisch fachlich korrekte Fehlerklassifikation.
  - Mitigation: Fachliche Fehlerübersetzung bleibt im jeweiligen Flow; die gemeinsame Primitive erzwingt nur Surface, Persistenz und Accessibility.
- Risiko: Transienter Create-Erfolg wird bei inkonsistenter Routennavigation erneut oder für den falschen Datensatz angezeigt.
  - Mitigation: einmaliger Konsum, Bindung an die erzeugte Datensatz-ID und keine Persistenz in URL oder langlebigem Store.
- Risiko: Zwei parallele Submit-Abschlüsse überschreiben sich.
  - Mitigation: Doppel-Submit während `saving` blockieren und Zustandsübergänge an den jeweils aktuellen Submit binden.
- Risiko: Partielle Erfolge werden als vollständiger Erfolg missverstanden.
  - Mitigation: kein `saved`-Zustand, persistente konkrete Meldung und ausschließlich teilschrittspezifischer Retry.
- Trade-off: Ein festes Zwei-Sekunden-Fenster ist weniger flexibel als pluginindividuelle Konfiguration.
  - Akzeptanz: Die feste Dauer ist gewollte UX-Governance und reduziert Drift sowie Testaufwand.

## Open Questions

Für PR 1 bestehen nach der Designfreigabe keine offenen Produkt- oder Architekturfragen. Die technische Form des transienten, typisierten Navigation-State wird bei der Implementierungsplanung gegen die im Workspace eingesetzte TanStack-Router-Version verifiziert, ohne auf Search-Params oder einen langlebigen globalen Store auszuweichen.
