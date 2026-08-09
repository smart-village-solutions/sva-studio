# Speicherfeedback in Studio-Formularen

## Grundsatz

Normale Create- und Update-Aktionen melden ihren Zustand im sichtbaren Formular. Der Speichern-Button zeigt nacheinander `Speichern`, `Wird gespeichert…` und für genau zwei Sekunden `✓ Gespeichert`. Dafür werden keine Toasts, Modals oder Overlays verwendet.

Validierungsfehler bleiben am jeweiligen Feld und werden über die bestehenden `StudioField`- und Form-Bridge-Primitives semantisch mit dem Control verknüpft. Technische, API- und Serverfehler erscheinen dagegen als persistenter Alert im betroffenen Formular oder Bereich.

## Gemeinsame Primitives

`@sva/studio-ui-react` stellt folgende Bausteine bereit:

- `StudioSaveButton` rendert den kontrollierten Zustand `idle`, `saving` oder `saved` mit stabiler Mindestbreite und höflicher Live-Region.
- `useStudioSaveFeedback` verwaltet den Zwei-Sekunden-Erfolgszeitraum, Timer-Cleanup, Dirty-Reset und den Schutz vor verspäteten Request-Abschlüssen.
- `StudioPersistentFormError` zeigt technische Fehler persistent mit `role="alert"` und optionaler konkreter Retry-Aktion.

Labels werden vom Host oder Plugin übersetzt übergeben. Das UI-Package besitzt keine Abhängigkeit auf ein bestimmtes i18n-System. Mutation, fachliches Fehlermapping und Dirty-/Reset-Semantik verbleiben im jeweiligen Formular.

## Save-Lifecycle

Ein Formular startet jeden zulässigen Submit mit `beginSaving()` und reicht die zurückgegebene Operations-ID an `markSaved()` oder `markFailed()` weiter. Nur der aktuelle Request darf den sichtbaren Zustand abschließen. Während `saving` verhindert der Button einen weiteren Submit.

Nach einem erfolgreichen Update setzt das Formular seine gespeicherten Werte zurück und ruft `markSaved()` auf. Eine spätere Eingabe ruft `markDirty()` auf und beendet den Erfolgszustand sofort. Ein technischer Fehler ruft `markFailed()` auf, lässt die persistente Fehlermeldung aber bis zu einem erfolgreichen Retry oder dem Verlassen des Kontexts sichtbar.

## Create-zu-Detail-Übergang

Ein erfolgreicher Create-Flow navigiert auf die kanonische Detailroute des erzeugten Datensatzes. Der einmalige `saved`-Zustand wird an die Datensatz-ID gebunden im transienten Router-History-State übergeben und auf der Zielroute per Replace konsumiert. Search-Parameter, Datensatzfelder, Session Storage und langlebige globale Stores sind dafür nicht zulässig.

## Sichere Retries und partielle Ergebnisse

Eine Retry-Aktion darf nur angeboten werden, wenn die Wiederholung fachlich sicher ist. Während des Retry bleibt der bisherige Fehler sichtbar; erst ein erfolgreicher Abschluss entfernt ihn.

Wenn der Primärwrite erfolgreich war, aber ein erforderlicher Folgeschritt scheitert, darf der Button nicht `Gespeichert` anzeigen. Im News-Editor wiederholt der Retry für fehlgeschlagene Medienreferenzen ausschließlich deren idempotente Synchronisierung und nicht den bereits erfolgreichen Inhaltswrite.

## Abgrenzung zu Toasts

Toasts sind nur für Aktionen ohne geeigneten stabilen Kontext vorgesehen, etwa `Link kopiert`, `Export gestartet` oder `Eintrag dupliziert`. Delete/Undo, destruktive Bestätigungen sowie Job- und Progress-Feedback besitzen eigene OpenSpec-Changes und werden nicht über den Save-Vertrag verallgemeinert.

## Referenzflüsse und weitere Migration

`/interfaces` ist der Host-Referenzfluss, der News-Editor der Plugin-Referenzfluss. Weitere Formulare werden erst nach der Inventur in `standardize-save-action-feedback` in fachlich zusammenhängenden PRs migriert. Plugins führen keine eigenen Save-Timer, Basis-Save-Buttons oder globalen Feedback-Renderer ein.
