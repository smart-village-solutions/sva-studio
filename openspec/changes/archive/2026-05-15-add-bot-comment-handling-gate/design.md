## Kontext

Das Repository besitzt bereits spezialisierte Review-Agents, eine dokumentierte Review-Governance und mehrere PR-Qualitygates. Was bisher fehlt, ist ein explizites Gate dafuer, dass maschinell erzeugte PR-Kommentare nicht unbeachtet bleiben. Der gewuenschte Prozess soll nicht die fachliche Entscheidung automatisieren, sondern erzwingen, dass zu jedem relevanten Bot-Kommentar eine dokumentierte Bearbeitung vorliegt.

## Zielbild

Vor dem Merge muss jeder relevante Kommentar von `Copilot` oder `chatgpt-codex-connector[bot]` einen Bearbeitungsnachweis haben. Der Nachweis unterscheidet dabei zwischen:

- umgesetzt
- bewusst nicht umgesetzt
- anderweitig erledigt

Die Governance fordert keinen Automatismus zur Uebernahme des Feedbacks. Sie fordert nur einen dokumentierten Abschluss pro Kommentar.

## Kommentararten

Der Change betrachtet zwei Arten von Kommentaren:

- Review-Threads auf Code-Diffs
- normale PR-Konversationskommentare

Beide Arten muessen vom Gate ausgewertet werden. Review-Threads koennen zusaetzlich den nativen Zustand `resolved` tragen. Normale PR-Kommentare brauchen stattdessen einen standardisierten textuellen Bearbeitungsnachweis durch eine menschliche Antwort.

## Bearbeitungsnachweis

Ein Kommentar gilt als bearbeitet, wenn mindestens eine menschliche Maintainer-Antwort den Kommentar eindeutig abschliesst. Fuer normale PR-Kommentare und fuer die inhaltliche Dokumentation von Review-Threads wird ein standardisierter Marker vorgesehen, zum Beispiel:

- `Handled: accepted`
- `Handled: rejected`
- `Handled: done`

Der Marker muss von einer kurzen Begruendung oder einem Verweis auf die Umsetzung begleitet werden. Fuer Review-Threads reicht ein blosses `resolved` ohne dokumentierte Antwort nicht aus; der Thread soll sowohl inhaltlich beantwortet als auch technisch geschlossen sein.

## Gate-Verhalten

Das PR-Gate ist blockierend. Es schlaegt fehl, wenn mindestens ein relevanter Bot-Kommentar keinen gueltigen Bearbeitungsnachweis hat. Das Gate listet die offenen Kommentare in einer maschinen- und menschenlesbaren Zusammenfassung auf.

Nicht im Scope dieses Changes:

- automatische Bewertung, ob eine Ablehnung fachlich korrekt war
- allgemeine Governance fuer menschliche Review-Kommentare
- automatische Aufloesung oder Beantwortung von Kommentaren

## Technische Hinweise

Die Identitaeten der betroffenen Bot-Autoren muessen mindestens `Copilot` und `chatgpt-codex-connector[bot]` umfassen. Fuer spaetere Erweiterbarkeit soll die Auswertung intern als explizite Allowlist modellierbar bleiben, auch wenn die Governance in diesem Change nur diese beiden Quellen verbindlich macht.

Die Auswertung muss zwischen Review-Thread-Kommentaren und normalen PR-Kommentaren unterscheiden und darf Kommentare anderer Autoren nicht als blockierend einstufen.
