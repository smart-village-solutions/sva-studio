## Context

Rechtstexte werden bereits versioniert verwaltet und Akzeptanzereignisse sind im Governance-/Audit-Pfad angelegt. Für den Angebotsabschluss fehlt aber die harte Durchsetzung im Login-Pfad sowie eine nachvollziehbare UI für Nachweis und Export.

## Goals / Non-Goals

- Goals:
  - Pflicht-Rechtstexte vor Fachzugriff erzwingen
  - Blockierenden Akzeptanzflow in der UI definieren
  - Admin-Nachweis und Export für Akzeptanzen spezifizieren
  - Audit-Konsistenz für Rechtstext-Nachweise schärfen
- Non-Goals:
  - Inhaltliche Pflege oder juristische Freigabe der Texte
  - Mobile Content-Erstellung
  - Allgemeine Governance-Workflow-Erweiterungen außerhalb Rechtstexten

## Decisions

- Decision: Die Prüfung erfolgt vor fachlichem Zugriff auf `/auth/me`-basierte Anwendungspfade.
  - Why: Nur so ist eine Umgehung über Deep-Links oder stale Client-State vermeidbar.
- Decision: Der Nutzer bekommt einen dedizierten, blockierenden Akzeptanz-Interstitital.
  - Why: Rechtstext-Akzeptanz ist kein optionaler Hintergrundprozess.
- Decision: Nachweis und Export werden als explizite Admin-Funktion modelliert.
  - Why: Backend-Export allein erfüllt die Angebotsaussage zur Admin-Oberfläche nicht.

## Risks / Trade-offs

- Harte Sperrlogik kann bei Fehlkonfigurationen zu Supportfällen führen.
  - Mitigation: klare Fehlerzustände und Fail-Closed-Regeln nur für Pflichttexte.
- Zusätzlicher Login-Schritt verschlechtert UX.
  - Mitigation: nur bei tatsächlich offenen Pflichtversionen aktivieren.

## Migration Plan

1. Pflichttext- und Akzeptanzstatus im Login-Pfad definieren
2. UI-Interstitital und Guard-Verhalten spezifizieren
3. Admin-Nachweis und Exportpfad spezifizieren
4. Audit- und Exportvertrag ergänzen

## Open Questions

- Liegt der Exportzugang in `/admin/legal-texts`, `/admin/iam` oder in beiden Sichten?
- Welche Dateiformate sind für den Admin-Nachweis im ersten Schnitt verpflichtend?
