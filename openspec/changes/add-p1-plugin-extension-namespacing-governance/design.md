## Context

Das Studio besitzt bereits eine Namespacing-Regel fuer Plugin-Action-IDs. Fuer andere Host-Registrierungen wie Content-Typen, Admin-Ressourcen und Audit-Ereignisse existiert diese Regel bislang nicht konsistent. Gleichzeitig laufen weitere aktive Changes fuer Build-time-Registry, Admin-Ressourcen, Lifecycle-Phasen, Extension-Tiers und Host-Guardrails. Dieser Change muss deshalb bewusst eng geschnitten sein: Er definiert nur die Benennungs- und Ownership-Regeln fuer registrierte Identifier, nicht den gesamten Plugin-Lifecycle oder die vollstaendige Governance.

## Goals

- Eine kanonische technische Plugin-Identitaet mit genau einem owning namespace je Plugin-Package
- Einheitliche Namensregeln fuer plugin-beigestellte registrierte Identifier ausserhalb der Action-IDs
- Deterministische Ownership- und Kollisionspruefung durch den Host
- Klare Abgrenzung zu benachbarten Plugin-Governance-Changes

## Non-Goals

- Keine erneute Definition der Action-ID-Regeln; dafuer bleibt `plugin-actions` kanonisch
- Keine Lifecycle-Phasen oder Materialisierungsreihenfolge; dafuer bleibt `add-p2-plugin-lifecycle-registration-phases` zustaendig
- Keine Erweiterungstiers oder Berechtigungsstufen fuer Packages; dafuer bleibt `add-p3-plugin-extension-tier-governance` zustaendig
- Keine Host-Guardrail- oder Security-Bypass-Regeln; dafuer bleibt `add-p1-host-enforced-plugin-guardrails` zustaendig
- Keine Namespacing-Regeln fuer Search-Facets oder i18n-Namespaces in diesem Change, weil dafuer noch kein ausreichend scharfes Zielmodell vorliegt
- Keine Umbenennung oder Nachnormierung core-eigener Identifier wie `generic` oder `legal`; der Change betrifft nur plugin-beigestellte registrierte Identifier
- Keine Migration oder Erhaltung von `plugin-example`; das Beispiel-Plugin ist kein Zielobjekt dieses Changes

## Decisions

- Jedes Plugin-Package besitzt genau einen kanonischen Namespace, der aus seiner technischen Plugin-Identitaet abgeleitet und in allen registrierten Host-Beitraegen wiederverwendet wird.
- Plugin-beigestellte registrierte Identifier ausserhalb der Action-IDs verwenden ein fully-qualified Format `<namespace>.<name>`.
- Dieser Change normiert zunaechst drei Identifier-Klassen: `contentType`, `admin resource id` und `audit event type`.
- Core-eigene Identifier duerfen ihre bestehenden hostseitigen Namen behalten; die Namespace-Pflicht gilt nur fuer plugin-beigestellte registrierte Identifier.
- Reservierte Core-Namespaces bleiben dem Host oder expliziten Core-Vertraegen vorbehalten und duerfen nicht von Plugins uebernommen werden.
- Der Host validiert Ownership und Kollisionen fail-fast waehrend der Registry-Erzeugung oder Host-Initialisierung.

## Consequences

- Bereits existierende unqualifizierte Plugin-Identifier wie ein nacktes `news`-`contentType` benoetigen eine bewusste Migration oder einen explizit dokumentierten Kompatibilitaetspfad; core-eigene Identifier wie `generic` oder `legal` sind davon nicht betroffen.
- Nachfolgende Plugin-Changes koennen dieselbe technische Plugin-Identitaet wiederverwenden, ohne eigene Namensmodelle fuer dieselben Identifier-Klassen einzufuehren.
- Die Route-Form oder UI-Translation-Keys muessen nicht automatisch denselben String verwenden; der Change normiert registrierte Identitaeten, nicht jede Anzeige- oder Pfadkonvention.

## Risks / Trade-offs

- Ein zu strenges Namensmodell kann bestehende Plugin-Integrationen wie `plugin-news` kurzfristig brechen.
- Ein zu weiches Modell wuerde die Kollisionsvermeidung erneut in spaetere Einzelvertraege verschieben.
- Die Abgrenzung zu laufenden Plugin-Changes muss in Proposal und Delta-Specs explizit bleiben, damit keine doppelte Normierung entsteht.
