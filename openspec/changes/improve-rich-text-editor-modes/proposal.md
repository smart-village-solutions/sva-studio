# Change: Rich-Text-Editor vereinheitlichen und HTML-Ansicht ergänzen

## Why

Die Rechtstext-Verwaltung verwendet noch einen lokalen `contentEditable`-Editor auf Basis von `document.execCommand`, während News und weitere Content-Plugins bereits den gemeinsamen TipTap-Editor aus `studio-ui-react` nutzen. Dadurch fehlen im Rechtstext-Editor Links, Formatierungsbefehle können browserabhängig wirkungslos bleiben und der gemeinsame Editor besitzt noch keinen abgesicherten Wechsel zwischen WYSIWYG und HTML-Quelltext.

## What Changes

- Der gemeinsame `RichTextHtmlEditor` erhält einen barrierefrei bedienbaren Moduswechsel zwischen WYSIWYG und einer editierbaren HTML-Quelltextansicht.
- Beide Modi bearbeiten denselben kontrollierten HTML-Wert; der Wechsel erzeugt keinen parallelen Entwurf und verliert keine gültigen Änderungen.
- Die HTML-Ansicht verwendet eine klar beschriftete, monospace dargestellte Textarea. Ungültiges beziehungsweise vom TipTap-Schema nicht unterstütztes HTML wird beim Wechsel zurück in WYSIWYG deterministisch normalisiert.
- Link- und Überschrifteninteraktionen werden mit echtem TipTap und einer realen Browserauswahl regressionsgetestet, insbesondere im News-Editor.
- Die Rechtstext-Anlage und -Bearbeitung wechseln vom lokalen `document.execCommand`-Editor auf den gemeinsamen Editor. Bestehendes client- und serverseitiges Rechtstext-Sanitizing bleibt erhalten.
- Der lokale Rechtstext-Editor wird entfernt, sobald keine produktive Verwendung mehr existiert.

## Impact

- Affected specs: `ui-layout-shell`, `content-management`
- Affected code: `packages/core`, `packages/studio-ui-react`, Mainserver-Eingabegrenzen, Content-Plugins, `apps/sva-studio-react/src/routes/admin/legal-texts`, Rechtstext-Übersetzungen und Editor-Tests
- Affected arc42 sections: Lösungsstrategie und Bausteinsicht für die gerichtete Abhängigkeit `@sva/studio-ui-react` → `@sva/core`
- Neue Dependencies: `sanitize-html` mit Typdefinitionen; die zentrale Sanitizer-Policy liegt in `@sva/core`
