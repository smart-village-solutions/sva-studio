## Context

Das Studio besitzt bereits mehrere Quellen für Berechtigungsanforderungen:

- deklarative Route- und Plugin-Guards,
- serverseitige IAM-Authorize-Entscheidungen,
- hostgeführte Fachoperationen,
- Mainserver-Fassaden und pluginlokale API-Adapter.

Diese Pfade liefern derzeit unterschiedliche `403`-Formate und überwiegend generische Meldungen. Route-Guards berechnen fehlende Permissions teilweise bereits, verwerfen sie aber vor der Weiterleitung. Einzelne Serverpfade tragen die geprüfte Action schon in Fehlerdetails, ohne dass ein gemeinsamer UI-Vertrag existiert.

## Goals / Non-Goals

### Goals

- Jede echte Berechtigungsablehnung benennt die serverseitig oder deklarativ geprüfte Action, soweit sie belastbar bekannt ist.
- Benutzer sehen einen lokalisierten Namen und die technische Action-ID.
- `allOf`, `anyOf`, Scope-/ABAC-Denials und technische IAM-Ausfälle bleiben semantisch unterscheidbar.
- Der Vertrag ist additiv, hostgeführt, framework-agnostisch und für Host- sowie Plugin-Actions einheitlich.
- Fehlermeldungen bleiben zugänglich, übersetzbar und frei von sensitiven Autorisierungsinterna.

### Non-Goals

- Keine Änderung an Grants, Rollen, Scopes oder der Permission Engine.
- Keine clientseitige Vorhersage der serverseitigen Autorisierungsentscheidung.
- Keine Offenlegung von effektiven Rollen, Gruppenquellen, Policies oder nicht freigegebenen Diagnostikfeldern.
- Keine pauschale Anreicherung fachlicher `403`-Antworten, die nicht aus einer Permission-Prüfung stammen.

## Decisions

### Decision: Gemeinsamer strukturierter Denial-Vertrag

Ein framework-agnostischer Vertrag beschreibt eine Berechtigungsanforderung mit:

- `required_permissions`: nichtleere, deduplizierte Liste fully-qualified Action-IDs,
- `requirement_mode`: `allOf` oder `anyOf`,
- `denial_reason`: stabiler, sicherer Grund wie `permission_missing`, `instance_scope_mismatch`, `context_attribute_missing` oder `abac_condition_unmet`,
- optionaler `requestId` über den bestehenden Fehlervertrag.

Bei API-Antworten werden diese Angaben additiv in den vorhandenen strukturierten Fehlerdetails transportiert. Der öffentliche Fehlercode bleibt kompatibel, üblicherweise `forbidden`. Route-Guards verwenden dasselbe fachliche Modell, aber keinen Server-Response-Typ.

Alternativen:

- Nur lokalisierte Freitextmeldungen: verworfen, weil Clients weiterhin Texte und Statuscodes reverse-engineeren müssten.
- Nur technische Action-ID anzeigen: verworfen, weil die Meldung für Fachanwender unnötig schwer verständlich wäre.
- Permission im Client aus der auslösenden UI ableiten: verworfen, weil dies bei veralteter UI, Scopes, ABAC und serverseitig gemappten Actions irreführend wäre.

### Decision: Serverseitige Action ist für Fachoperationen autoritativ

Serverseitige Permission-Gates geben die tatsächlich geprüfte Action in den Denial-Vertrag. Frontend-API-Adapter validieren und normalisieren ausschließlich diese sicheren Felder. Sie ergänzen keine vermutete Permission aus dem Button, dem Endpunktnamen oder einer lokalen Capability.

Nur deklarative Client-Route-Guards dürfen ihren eigenen Guard-Vertrag als Quelle verwenden, weil genau dieser Vertrag die Route gesperrt hat. Dabei werden bei `allOf` nur die tatsächlich fehlenden Actions und bei `anyOf` die zulässigen Alternativen transportiert.

### Decision: Kontextgerechte Texte statt pauschal „fehlt“

Die gemeinsame Darstellung unterscheidet:

- `permission_missing` + eine Action: „Fehlende Berechtigung: {Titel} (`{id}`)“.
- `permission_missing` + `allOf`: „Folgende Berechtigungen fehlen: …“.
- `permission_missing` + `anyOf`: „Eine der folgenden Berechtigungen ist erforderlich: …“.
- Scope-/ABAC-/Hierarchie-Denial: „Die Berechtigung ist im aktuellen Kontext nicht ausreichend. Erforderliche Aktion: …“.
- unbekannter oder technisch nicht belastbarer Zustand: allgemeiner lokalisierter Autorisierungs- beziehungsweise Verfügbarkeitsfehler ohne behauptete fehlende Action.

Die Anzeige verwendet einen zugänglichen persistenten Fehlerzustand beziehungsweise ein bestehendes Alert-Primitive. Die Action-ID wird als Text ausgegeben und darf kopiert werden; Farbe allein trägt keine Information.

### Decision: Gemeinsame Label-Auflösung mit sicherem Fallback

Ein zentraler Display-Katalog verbindet:

- lokalisierte Host-/Core-Permission-Namen,
- registrierte `PluginPermissionDefinition.titleKey`-Einträge,
- die technische Action-ID als immer verfügbaren Fallback.

Deutsch und Englisch werden vollständig geprüft. Eine fehlende oder unbekannte Übersetzung darf die Fehleranzeige nicht verhindern und zeigt stattdessen ausschließlich die validierte Action-ID. Plugin-Code rendert keinen eigenen parallelen Permission-Fehlerformatter.

### Decision: Route-Denials werden begrenzt und einmalig übertragen

Der Routing-Layer überträgt nur Action-IDs aus der tatsächlich ausgewerteten Guard-Deklaration. Der Denial-Kontext wird normalisiert, dedupliziert, in Anzahl und Länge begrenzt und von der Zielseite einmalig konsumiert. Manipulierte Eingaben dürfen höchstens eine lokale Fehlermeldung beeinflussen und niemals Autorisierung, Navigation oder serverseitige Entscheidungen verändern.

Die konkrete Transporttechnik wird bei der Implementierung anhand des bestehenden TanStack-Router-Vertrags gewählt. Ein URL-basierter Transport muss katalogvalidiert und nach dem Konsum entfernt werden; ein tablokaler Referenzspeicher muss Reload- und Mehrtab-Verhalten explizit testen.

## Error and Security Boundaries

- Permission-IDs gelten als nicht-sensitive Katalogmetadaten, werden aber nur authentifizierten Benutzern im konkreten Denial-Kontext angezeigt.
- Rollen, Gruppen, Grant-Herkünfte, fremde effektive Rechte, Policy-Ausdrücke und rohe Diagnoseobjekte bleiben verborgen.
- `permissionStatus: degraded`, fehlende Snapshots, Redis-/Datenbankfehler oder fehlender Instanzkontext dürfen nicht als konkrete fehlende Permission ausgegeben werden.
- Ein `403` wegen CSRF, Hostvalidierung, Principal-Auswahl oder anderer fachlicher Regeln wird nur dann als Permission-Denial dargestellt, wenn der autoritative Serverpfad den strukturierten Permission-Vertrag liefert.
- Logs und OTEL behalten tiefere Diagnostik; die sichtbare Meldung nutzt nur den öffentlichen allowlist-basierten Vertrag.

## Migration Plan

1. Framework-agnostische Typen, Parser, Normalisierung und Formatierungsmodell ergänzen.
2. Host-/Plugin-Display-Katalog und DE/EN-Auflösung bereitstellen.
3. Route-Guards und zentrale Route-Denial-Anzeige migrieren.
4. Gemeinsame Server-Autorisierungshelfer so erweitern, dass sie strukturierte Denial-Details erzeugen.
5. IAM-, Medien-, Waste-, Mainserver- und Plugin-Operations-Pfade auf den gemeinsamen Helper beziehungsweise Adapter migrieren.
6. Verbleibende generische Permission-`403`-Pfade inventarisieren und durch Vertrags- oder Katalogtests absichern.
7. Architektur- und Entwicklerdokumentation aktualisieren.

Die Migration bleibt additiv: bestehende Clients dürfen `details` ignorieren. Ein Fachbereich gilt erst als migriert, wenn Serverantwort, Clientparser, UI-Ausgabe und Negativtests denselben Vertrag verwenden.

## Risks / Trade-offs

- Uneinheitliche historische `403`-Formate können unvollständige Abdeckung erzeugen.
  - Mitigation: Inventar der zentralen und fachlichen Gates, Vertragsparser und Negativtest pro migriertem Pfad.
- Eine benannte Action könnte bei Scope-/ABAC-Denials fälschlich als komplett fehlend verstanden werden.
  - Mitigation: eigener `denial_reason` und kontextbezogene Formulierung.
- Ungeprüfte URL-Parameter könnten irreführende Meldungen erzeugen.
  - Mitigation: nur validierte, begrenzte Guard-Daten konsumieren und nach Anzeige entfernen.
- Plugin-Übersetzungen können unvollständig sein.
  - Mitigation: Vollständigkeitsgate und stabiler Fallback auf die technische ID.

## Test Strategy

- Unit-Tests für Parser, Deduplizierung, Begrenzung, `allOf`, `anyOf` und Fallbacks.
- Routing-Tests für eine und mehrere fehlende Permissions, alternative Anforderungen, degradierte Snapshots, Redirect-Konsum, Reload und manipulierte Eingaben.
- Server-Vertragstests für alle zentralen Authorization-Helper sowie je einen Referenzpfad aus IAM, Medien, Mainserver, Waste und Plugin-Operations.
- UI-Tests für lokalisierter Titel plus Action-ID, Scope-Text, unbekannte Action, DE/EN und zugänglichen Alert-Zustand.
- Katalogtests für registrierte Host- und Plugin-Actions sowie Übersetzungsvollständigkeit.
- E2E-Tests für verweigerten Seitenzugriff, Speichern und Löschen.
- Security-Regressionsprüfung, dass keine Rollen-, Gruppen-, Grant- oder Policy-Daten im Browservertrag erscheinen.

## Open Questions

- Keine fachlichen Fragen offen. Die konkrete Router-Transporttechnik wird in der Implementierung anhand der beschriebenen Sicherheits- und Reload-Kriterien entschieden.
