# Change: Jahres-Tourensatz in das direkte Folgejahr übernehmen

## Why

Die Vorbereitung eines neuen Abfalljahres erfordert heute, jede Tour einzeln zu duplizieren und ihre Zeitplanung anschließend manuell anzupassen. Der reale Arbeitsablauf ist ein klarer Jahreswechsel: Ein ausgewählter Bestand des Vorjahres soll als gemeinsam prüfbare, zunächst inaktive Grundlage für das unmittelbar folgende Kalenderjahr angelegt werden.

## What Changes

- Ein mehrstufiger Assistent erfasst ausschließlich das Quelljahr; das System leitet das unveränderliche Folgejahr als `Quelljahr + 1` ab.
- Eine serverseitige Vorschau ordnet alle im Quelljahr relevanten Touren nachvollziehbar als `wird übernommen`, `gilt bereits im Folgejahr` oder `blockiert` ein, ohne Daten zu verändern.
- Der Assistent verwendet genau einen Übernahmevertrag: Stammdaten und kopierrelevante Beziehungen werden vollständig übernommen, wiederkehrende Touren führen ihren Tagesrhythmus fort und konkrete Jahresdaten werden nach einer festen Folgejahrregel abgebildet.
- Pro Jahresübernahme gelten feste serverseitige Grenzen von 1.000 Touren und 100.000 kopierrelevanten Beziehungen.
- Eine bestätigte Vorschau wird nur geschrieben, solange ihr fachlicher Fingerprint unverändert ist und keine neuen Zielkonflikte entstanden sind.
- Der bestätigte Tourensatz wird mit stabilen fachlichen Ziel-IDs vollständig atomar, idempotent und zunächst inaktiv angelegt.
- Erstellung und Wiederholungen werden berechtigungsgebunden und datensparsam auditiert, ohne eine neue persistierte Jahreswechsel-Entität, einen neuen Tourstatus oder eine Aktivierungsfunktion einzuführen.

## Impact

- Related issue: `smart-village-solutions/sva-studio#1125`
- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`, `packages/core`, `packages/auth-runtime`, `packages/data-repositories`, `apps/sva-studio-react`
- Affected documentation: Waste-Management-Jahreswechsel und Tourpflege
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
- Database schema: keine neue Workflow-Tabelle, kein neuer Tourstatus und keine neue fachliche Provenienzspalte vorgesehen
