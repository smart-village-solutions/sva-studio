## Context

`RichTextHtmlEditor` kapselt bereits TipTap mit StarterKit und Link-Extension und wird von mehreren Content-Plugins genutzt. Die Rechtstextseiten besitzen daneben eine ältere lokale Implementierung. Der neue HTML-Modus soll keine zweite Editor-Engine etablieren, sondern lediglich den bereits kontrollierten HTML-Wert direkt bearbeitbar machen.

## Goals / Non-Goals

- Goals:
  - ein gemeinsamer Editorpfad für Rechtstexte und Content-Plugins
  - zuverlässige Link- und Überschriftenformatierung mit echter Auswahl
  - verlustarmer, zugänglicher Wechsel zwischen WYSIWYG und HTML
  - Erhaltung der bestehenden Sanitizing-Grenzen
- Non-Goals:
  - kein neuer Rich-Text-Datenvertrag
  - kein vollständiger HTML-/CSS-Editor
  - keine zweite Editorbibliothek
  - keine Erweiterung der erlaubten Rechtstext-Tags oder Linkprotokolle

## Decisions

- Decision: Der Moduszustand bleibt lokal im gemeinsamen Editor; `value` und `onChange` bleiben der einzige fachliche Datenvertrag.
  - Rationale: Formulare benötigen keinen zweiten Draft und bestehende Bindings bleiben kompatibel.

- Decision: Der Moduswechsel wird als kompakte Gruppe aus zwei Design-System-Buttons mit `aria-pressed` umgesetzt.
  - Rationale: Es handelt sich um zwei Ansichten desselben Felds, nicht um Seiten- oder Bereichsnavigation.

- Decision: Die HTML-Ansicht ist editierbar und verwendet die bestehende `Textarea` mit monospace Typografie, sichtbarer Beschriftung und denselben Invalid-/Description-Beziehungen wie der WYSIWYG-Modus.
  - Rationale: Redaktion und Support können den tatsächlichen persistierten Wert prüfen und gezielt korrigieren.

- Decision: Beim Rückwechsel in WYSIWYG wird HTML durch das konfigurierte TipTap-Schema geparst und normalisiert; Rechtstexte werden zusätzlich weiterhin über ihren bestehenden Client- und Server-Sanitizer abgesichert.
  - Rationale: Nicht unterstützte oder gefährliche Strukturen dürfen nicht unbemerkt als WYSIWYG-Inhalt weiterbestehen.

- Decision: Die gemeinsame Allowlist-Sanitizer-Policy liegt framework-agnostisch in `@sva/core`; `@sva/studio-ui-react` und die Mainserver-Eingabegrenzen verwenden dieselbe Implementierung auf Basis von `sanitize-html`.
  - Rationale: Client und Server dürfen bei sicherheitsrelevanten Tags, Attributen und Protokollen nicht durch duplizierte Policies auseinanderlaufen.

- Decision: Die bestehende native Linkeingabe bleibt zunächst unverändert. Änderungen an Fokus- oder Selection-Logik erfolgen nur, wenn der echte Browser-Repro den Fehler bestätigt.
  - Rationale: TipTap verwaltet Auswahl und Commands; zusätzliche Eigenlogik braucht einen belegten Fehler.

## Risks / Trade-offs

- HTML kann während der Eingabe vorübergehend unvollständig sein. Deshalb wird nicht bei jedem Tastendruck destruktiv normalisiert, sondern beim Wechsel in WYSIWYG.
- TipTap verwirft nicht unterstützte Tags und Attribute. Der Moduswechsel muss diese Normalisierung über `onChange` sichtbar in den kontrollierten Wert übernehmen.
- Ein nativer Browser-Prompt ist funktional, aber UX-seitig begrenzt. Ein eigener Linkdialog bleibt außerhalb dieses Changes, solange er nicht als Fehlerursache bestätigt ist.

## Migration Plan

1. Gemeinsamen Editor mit HTML-Modus und echten Integrationstests erweitern.
2. News-Browser-Repro für Link und Überschrift ergänzen und nur belegte Fehler korrigieren.
3. Rechtstextseiten auf den gemeinsamen Editor umstellen und Sanitizing-Vertrag testen.
4. Unbenutzten lokalen Editor entfernen und die betroffenen Nx-Gates ausführen.
