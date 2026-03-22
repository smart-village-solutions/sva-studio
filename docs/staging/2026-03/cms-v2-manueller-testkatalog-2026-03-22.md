# Manueller Testkatalog CMS v2

## Zweck

Dieses Dokument beschreibt 50 priorisierte manuelle Testszenarien für die User Stories aus `concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json`.

Ziel ist kein 1:1-Abgleich aller Stories, sondern eine risikobasierte Abdeckung der wichtigsten Benutzerreisen und Berechtigungsfälle.

## Nutzung

1. Tests in der angegebenen Reihenfolge ausführen.
2. Ergebnisse im separaten Protokoll unter `docs/staging/2026-03/cms-v2-testprotokoll-vorlage-2026-03-22.md` dokumentieren.
3. Bei Fehlern immer Rolle, Mandant, Organisation, betroffenen Inhalt und den exakten Schritt notieren.

## Empfohlene Testdaten

- Mindestens 2 Mandanten
- Je Mandant mindestens 2 Organisationen, davon 1 Unterorganisation
- Rollen: Redakteur:in, Organisations-Admin, Fachbereichsleiter:in, Datenschutzbeauftragte:r, Onboarding-Verantwortliche:r, Support-Verantwortliche:r, Betreiber:in
- Gruppen: Redaktionsteam, Fachbereich, Standort, Datenschutz
- Inhalte: global, organisationsbezogen, gesperrt, veröffentlicht, personenbezogen, eigenen Nutzer:innen zugewiesen
- Rechtstexte: mindestens 2 Versionen, davon 1 Entwurf und 1 aktiv

## Priorisierte Szenarien

### S01 Redakteur sieht nur Inhalte der eigenen Organisation

Bezug: Stories 1, 8, 54, 85

- Rolle: Redakteur:in
- Vorbereitung: Nutzer hat Zugriff auf Organisation A, nicht auf Organisation B; zusätzlich existiert globaler Inhalt.
- Schritte:
  1. Als Redakteur:in anmelden.
  2. Inhaltsübersicht öffnen.
  3. Sichtbare Inhalte prüfen.
- Erwartung:
  - Inhalte aus Organisation A sind sichtbar.
  - Inhalte aus Organisation B sind nicht sichtbar.
  - Globale Inhalte sind sichtbar und erkennbar markiert.

### S02 Redakteur erkennt lesbare vs. bearbeitbare Inhalte

Bezug: Stories 2, 5, 81, 82

- Rolle: Redakteur:in
- Vorbereitung: Ein Inhalt ist nur lesbar, ein anderer bearbeitbar.
- Schritte:
  1. Inhaltsliste öffnen.
  2. Beide Inhalte vergleichen.
  3. Detailseite und Aktionsmenü öffnen.
- Erwartung:
  - Bearbeitbare Inhalte zeigen Bearbeiten-Aktionen.
  - Nur lesbare Inhalte zeigen keine unzulässigen Aktionen.
  - Rechte sind verständlich erkennbar.

### S03 Redakteur findet eigene Inhalte schnell

Bezug: Stories 3, 51

- Rolle: Redakteur:in
- Vorbereitung: Mehrere Inhalte verschiedener Autor:innen vorhanden.
- Schritte:
  1. Inhaltssuche oder Filter öffnen.
  2. Eigene Inhalte filtern.
  3. Zugewiesene Inhalte prüfen.
- Erwartung:
  - Eigene und zugewiesene Inhalte sind gezielt auffindbar.

### S04 Redakteur erkennt Urheber eines Inhalts

Bezug: Story 4

- Rolle: Redakteur:in
- Schritte:
  1. Inhaltsdetail öffnen.
  2. Metadaten prüfen.
- Erwartung:
  - Ersteller:in ist eindeutig sichtbar.

### S05 Redakteur erhält verständliche Fehlermeldung bei fehlenden Rechten

Bezug: Stories 7, 83, 126

- Rolle: Redakteur:in
- Vorbereitung: Nutzer versucht eine nicht erlaubte Aktion.
- Schritte:
  1. Nicht erlaubte Bearbeitung auslösen.
  2. Fehlermeldung lesen.
- Erwartung:
  - Fehler ist fachlich verständlich.
  - Wenn vorgesehen, wird eine zuständige Kontaktstelle genannt.

### S06 Redakteur sieht Rollen und Rechtequellen

Bezug: Stories 9, 10, 125

- Rolle: Redakteur:in
- Schritte:
  1. Profil oder Rechteansicht öffnen.
  2. Rollen, Gruppen und Quellen der Rechte prüfen.
- Erwartung:
  - Direkte Rollen, Gruppen und daraus resultierende Rechte sind nachvollziehbar.

### S07 Redakteur kann zwischen vertretenen Organisationen wechseln

Bezug: Story 84

- Rolle: Redakteur:in
- Vorbereitung: Nutzer vertritt mindestens 2 Organisationen.
- Schritte:
  1. Aktive Organisation prüfen.
  2. Organisation wechseln.
  3. Inhalts- und Aktionssicht erneut prüfen.
- Erwartung:
  - Kontext wechselt sichtbar.
  - Inhalte und Rechte passen sich dem neuen Kontext an.

### S08 Redakteur erkennt geografischen Zuständigkeitsbereich

Bezug: Story 96

- Rolle: Redakteur:in
- Vorbereitung: Rechte sind auf Region oder Stadtteil begrenzt.
- Schritte:
  1. Rechteansicht oder Bearbeitungsmaske öffnen.
  2. Erlaubte Regionen prüfen.
- Erwartung:
  - Zulässige geografische Bereiche sind klar erkennbar.

### S09 Redakteur erkennt gesperrte Inhalte

Bezug: Story 55

- Rolle: Redakteur:in
- Schritte:
  1. Inhaltsliste und Inhaltsdetail öffnen.
  2. Gesperrten Inhalt auswählen.
- Erwartung:
  - Sperrstatus ist sichtbar.
  - Konfliktvermeidendes Verhalten ist verständlich.

### S10 Mobile Darstellung der Rechtehinweise

Bezug: Story 53

- Rolle: Redakteur:in
- Schritte:
  1. Anwendung in mobiler Breite öffnen.
  2. Inhaltsliste und Detailseite prüfen.
- Erwartung:
  - Rechtehinweise und erlaubte Aktionen bleiben verständlich.

### S11 Organisations-Admin legt neuen Nutzer an

Bezug: Stories 11, 46

- Rolle: Organisations-Admin
- Schritte:
  1. Nutzerverwaltung öffnen.
  2. Neuen Nutzer anlegen.
  3. Speichern und Ergebnis prüfen.
- Erwartung:
  - Nutzer wird erfolgreich erstellt.
  - Neuer Datensatz erscheint in der Übersicht.

### S12 Organisations-Admin weist Nutzer einer Organisation zu

Bezug: Stories 12, 15

- Rolle: Organisations-Admin
- Schritte:
  1. Bestehenden Nutzer öffnen.
  2. Organisation zuweisen.
  3. Übersicht neu laden.
- Erwartung:
  - Organisationszuordnung ist sichtbar und konsistent.

### S13 Organisations-Admin vergibt Rolle direkt

Bezug: Stories 13, 59

- Rolle: Organisations-Admin
- Schritte:
  1. Nutzer öffnen.
  2. Rolle zuweisen.
  3. Effektive Rechte des Nutzers prüfen.
- Erwartung:
  - Rolle ist gespeichert.
  - Effektive Rechte entsprechen der Zuweisung.

### S14 Organisations-Admin erstellt und verwendet Gruppe

Bezug: Stories 14, 57, 98

- Rolle: Organisations-Admin
- Schritte:
  1. Neue Gruppe anlegen.
  2. Gruppe mit Rechten oder Rolle versehen.
  3. Nutzer zur Gruppe hinzufügen.
- Erwartung:
  - Gruppe ist wiederverwendbar.
  - Rechte wirken über die Gruppenmitgliedschaft.

### S15 Organisationsstruktur und Unterorganisationen verwalten

Bezug: Stories 16, 17

- Rolle: Organisations-Admin
- Schritte:
  1. Organisationsverwaltung öffnen.
  2. Unterorganisation anlegen oder bearbeiten.
  3. Hierarchie prüfen.
- Erwartung:
  - Struktur wird korrekt dargestellt.

### S16 Rollenvererbung in Unterorganisation prüfen

Bezug: Stories 18, 97, 127

- Rolle: Organisations-Admin oder Fachbereichsleiter:in
- Vorbereitung: Rolle wird auf übergeordneter Ebene vergeben.
- Schritte:
  1. Rechte in der Unterorganisation prüfen.
  2. Quelle des Rechts prüfen.
- Erwartung:
  - Vererbte Rechte sind wirksam und als vererbt erkennbar.

### S17 Rollenänderung wird sofort wirksam

Bezug: Stories 19, 28

- Rolle: Organisations-Admin
- Schritte:
  1. Rolle eines aktiven Nutzers ändern.
  2. Betroffenen Nutzer neu prüfen, ohne lange Wartezeit.
- Erwartung:
  - Rechteänderung ist unmittelbar sichtbar.

### S18 Warum-hat-der-Nutzer-Zugriff nachvollziehen

Bezug: Stories 20, 93, 94, 99

- Rolle: Organisations-Admin
- Schritte:
  1. Nutzer öffnen.
  2. Effektive Rechte und Herkunft aufrufen.
  3. Indirekte Gruppen und Vererbungen prüfen.
- Erwartung:
  - Für jedes relevante Recht ist die Quelle nachvollziehbar.

### S19 Berechtigungen simulieren

Bezug: Stories 58, 92, 123

- Rolle: Organisations-Admin
- Schritte:
  1. Simulationsfunktion öffnen.
  2. Geplante Rollenänderung konfigurieren.
  3. Ergebnis prüfen.
- Erwartung:
  - Zukünftige effektive Rechte werden plausibel angezeigt.

### S20 Globale vs. lokale Rechte unterscheiden

Bezug: Story 86

- Rolle: Organisations-Admin
- Schritte:
  1. Rechteansicht öffnen.
  2. Ein globales und ein lokales Recht vergleichen.
- Erwartung:
  - Unterschied ist klar ausgewiesen.

### S21 Granulare Rechte vergeben

Bezug: Story 87

- Rolle: Organisations-Admin
- Schritte:
  1. Rolle oder Berechtigung bearbeiten.
  2. Nur einzelne Aktionen freigeben.
  3. Ergebnis aus Nutzersicht prüfen.
- Erwartung:
  - Nur die freigegebenen Aktionen sind erlaubt.

### S22 Mandantenspezifische Rolle anlegen

Bezug: Story 90

- Rolle: Organisations-Admin
- Schritte:
  1. Neue Rolle im Mandanten anlegen.
  2. Rolle benennen und speichern.
  3. Sichtbarkeit in anderem Mandanten prüfen.
- Erwartung:
  - Rolle ist nur im eigenen Mandanten vorhanden.

### S23 Bestehende Rolle kopieren und anpassen

Bezug: Story 91

- Rolle: Organisations-Admin
- Schritte:
  1. Vorhandene Rolle kopieren.
  2. Anpassung vornehmen.
  3. Original und Kopie vergleichen.
- Erwartung:
  - Kopie ist eigenständig und bearbeitbar.

### S24 Regionale Rechte beschränken

Bezug: Story 95

- Rolle: Organisations-Admin
- Schritte:
  1. Recht auf Stadtteil oder Region begrenzen.
  2. Mit betroffenem Redakteur prüfen.
- Erwartung:
  - Bearbeitung ist nur im erlaubten Raum möglich.

### S25 Nutzer deaktivieren

Bezug: Stories 100, 102

- Rolle: Organisations-Admin
- Schritte:
  1. Nutzer deaktivieren.
  2. Erneute Anmeldung oder Aktion testen.
  3. Audit-Information prüfen.
- Erwartung:
  - Zugriff wird sofort entzogen.
  - Zeitpunkt des Entzugs ist nachvollziehbar.

### S26 Verantwortlichkeiten übergeben

Bezug: Story 101

- Rolle: Organisations-Admin
- Schritte:
  1. Ausscheidenden Nutzer auswählen.
  2. Verantwortlichkeiten an andere Person übertragen.
  3. Inhalte und Zuständigkeiten prüfen.
- Erwartung:
  - Keine verwaisten Zuständigkeiten bleiben zurück.

### S27 Mandantentrennung für Organisations-Admin

Bezug: Story 109

- Rolle: Organisations-Admin
- Schritte:
  1. Nutzer, Rollen, Gruppen und Rechtstexte anzeigen.
  2. Auf Daten anderer Mandanten prüfen.
- Erwartung:
  - Es sind ausschließlich Daten des eigenen Mandanten sichtbar.

### S28 Fachbereichsleiter sieht zuständige Personen im Bereich

Bezug: Stories 41, 71, 75

- Rolle: Fachbereichsleiter:in
- Schritte:
  1. Bereichsübersicht öffnen.
  2. Team und Zuständigkeiten prüfen.
- Erwartung:
  - Verantwortlichkeiten und Teamrechte sind sichtbar.

### S29 Fachbereichsleiter steuert Freigaben

Bezug: Stories 43, 44, 72

- Rolle: Fachbereichsleiter:in
- Schritte:
  1. Veröffentlichte oder freizugebende Inhalte aufrufen.
  2. Freigabeprozess prüfen.
- Erwartung:
  - Relevante Inhalte sind sichtbar.
  - Freigaben können innerhalb der erlaubten Rechte gesteuert werden.

### S30 Fachbereichsleiter delegiert oder beschränkt Rechte

Bezug: Stories 42, 45, 73

- Rolle: Fachbereichsleiter:in
- Schritte:
  1. Rolle oder Delegation im Bereich vornehmen.
  2. Wirkung bei betroffener Person prüfen.
- Erwartung:
  - Delegation oder Einschränkung wirkt nur im erlaubten Bereich.

### S31 Systembetreiber verwaltet Nutzer mandantenübergreifend zentral

Bezug: Stories 21, 61

- Rolle: Systembetreiber
- Schritte:
  1. Zentrale Nutzerverwaltung öffnen.
  2. Nutzer mehrerer Mandanten prüfen.
- Erwartung:
  - Zentrale Verwaltung ist möglich, ohne Mandantentrennung fachlich zu verletzen.

### S32 Authentifizierungsprozesse und Login-Vorgänge nachvollziehen

Bezug: Stories 22, 23, 62

- Rolle: Systembetreiber
- Schritte:
  1. Login ausführen oder vorhandenen Vorgang wählen.
  2. Monitoring oder Logansicht öffnen.
- Erwartung:
  - Login-Ereignisse und technische Details sind nachvollziehbar.

### S33 Systemrollen oder zentrale Regeln definieren

Bezug: Stories 24, 63

- Rolle: Systembetreiber
- Schritte:
  1. Zentrale Rollen- oder Regelverwaltung öffnen.
  2. Neue Regel definieren oder bestehende ändern.
- Erwartung:
  - Systemweite Regel ist pflegbar und konsistent sichtbar.

### S34 Performance der Rechteprüfung beobachten

Bezug: Stories 26, 65

- Rolle: Systembetreiber
- Schritte:
  1. Eine Serie berechtigungsrelevanter Aufrufe auslösen.
  2. Monitoring prüfen.
- Erwartung:
  - Relevante Performance-Signale sind sichtbar und auswertbar.

### S35 Cache-Mechanismus und Invalidierung nachvollziehen

Bezug: Stories 27, 28, 29

- Rolle: Systembetreiber
- Schritte:
  1. Berechtigungsentscheidung aufrufen.
  2. Rolle ändern.
  3. Entscheidung erneut prüfen.
  4. Begründung oder zentrale Entscheidung einsehen.
- Erwartung:
  - Veraltete Rechte werden nicht weiter ausgeliefert.
  - Entscheidungen sind zentral nachvollziehbar.

### S36 Betreiber erkennt aktuellen Mandantenkontext

Bezug: Stories 107, 108

- Rolle: Betreiber:in
- Schritte:
  1. Oberfläche öffnen.
  2. Aktiven Mandanten prüfen.
  3. Mandantenübergreifende Aktion anstoßen.
- Erwartung:
  - Der Kontext ist jederzeit sichtbar.
  - Mandantenübergreifende Rechte werden bewusst und deutlich erkennbar genutzt.

### S37 Betreiber sieht konsistente Entscheidungen in mehreren Modulen

Bezug: Stories 122, 128

- Rolle: Betreiber:in
- Schritte:
  1. Dieselbe Berechtigungsfrage in mehreren Modulen prüfen.
  2. Änderungen an Rollen oder Gruppen nachvollziehen.
- Erwartung:
  - Entscheidungen sind modulübergreifend konsistent.
  - Änderungen sind auditierbar.

### S38 Datenschutz: Wer darf welche Daten sehen

Bezug: Stories 31, 36, 69, 129

- Rolle: Datenschutzbeauftragte:r
- Schritte:
  1. Sicht auf personenbezogene Daten öffnen.
  2. Zugriffsberechtigte Rollen und Personen prüfen.
- Erwartung:
  - Zugriffsberechtigungen sind transparent.
  - Unberechtigte Zugriffe sind nicht erkennbar als erlaubt.

### S39 Datenschutz: Unzulässige Zugriffe erkennen

Bezug: Stories 37, 38

- Rolle: Datenschutzbeauftragte:r
- Schritte:
  1. Zugriffshistorie oder Auditansicht öffnen.
  2. Auffällige oder unzulässige Zugriffe suchen.
- Erwartung:
  - Historie ist prüfbar.
  - Auffällige Vorgänge sind erkennbar.

### S40 Datenschutz: Reports und Nachweise exportieren

Bezug: Stories 35, 70, 116, 118

- Rolle: Datenschutzbeauftragte:r
- Schritte:
  1. Reportansicht öffnen.
  2. Nach Organisation oder Zeitraum filtern.
  3. Export ausführen.
- Erwartung:
  - Export funktioniert.
  - Filter werden korrekt angewendet.

### S41 Datenschutz: Rechtstext-Versionen verwalten

Bezug: Stories 33, 110, 111

- Rolle: Datenschutzbeauftragte:r
- Schritte:
  1. Bestehende Rechtstexte öffnen.
  2. Neue Version als Entwurf anlegen.
  3. Entwurf aktivieren.
- Erwartung:
  - Versionen und Status sind nachvollziehbar.

### S42 Datenschutz: Zustimmungshistorie eines Nutzers prüfen

Bezug: Stories 32, 34, 117

- Rolle: Datenschutzbeauftragte:r
- Schritte:
  1. Einen Nutzer auswählen.
  2. Akzeptanzhistorie öffnen.
- Erwartung:
  - Sichtbar sind Zeitpunkt und konkrete Fassung des akzeptierten Rechtstexts.

### S43 Datenschutz: Nutzer zur Zustimmung zwingen

Bezug: Stories 39, 40, 119

- Rolle: Datenschutzbeauftragte:r
- Schritte:
  1. Neue Fassung aktivieren.
  2. Liste der noch nicht zustimmenden Nutzer prüfen.
- Erwartung:
  - Nicht zustimmende Nutzer sind identifizierbar.
  - Zustimmungspflicht ist technisch wirksam.

### S44 Nutzer sieht beim Login neue Rechtstexte

Bezug: Story 113

- Rolle: Nutzer:in des SVA Studio
- Schritte:
  1. Mit Nutzer ohne aktuelle Zustimmung anmelden.
- Erwartung:
  - Hinweis auf neue Rechtstexte erscheint unmittelbar beim Login.

### S45 Nutzer kann Rechtstexte vollständig lesen

Bezug: Story 114

- Rolle: Nutzer:in des SVA Studio
- Schritte:
  1. Rechtstext öffnen.
  2. Vollständigkeit und Lesbarkeit prüfen.
- Erwartung:
  - Rechtstext ist vor Zustimmung vollständig einsehbar.

### S46 Nutzer kehrt nach Zustimmung zum ursprünglichen Einstiegspunkt zurück

Bezug: Story 115

- Rolle: Nutzer:in des SVA Studio
- Schritte:
  1. Geschützten Einstiegspunkt aufrufen.
  2. Rechtstext zustimmen.
- Erwartung:
  - Danach erfolgt die Rückkehr an den ursprünglichen Einstiegspunkt.

### S47 Onboarding: Einladung und Standardrollen

Bezug: Stories 47, 49, 76

- Rolle: Onboarding-Verantwortliche:r
- Schritte:
  1. Einladung aussprechen.
  2. Standardrolle oder Vorlage zuweisen.
  3. Ergebnis prüfen.
- Erwartung:
  - Einladung und Rollenvorbelegung sind nachvollziehbar gespeichert.

### S48 Onboarding: Status eines Accounts nachvollziehen

Bezug: Stories 48, 50, 103, 104

- Rolle: Onboarding-Verantwortliche:r
- Schritte:
  1. Accountstatus öffnen.
  2. Fortschritt und eventuellen Hänger prüfen.
- Erwartung:
  - Statusschritte wie eingeladen, registriert, synchronisiert und freigeschaltet sind sichtbar.

### S49 Onboarding: Synchronisationsfehler erkennen

Bezug: Stories 78, 105, 106

- Rolle: Onboarding-Verantwortliche:r oder Organisations-Admin
- Schritte:
  1. Problematischen Account öffnen.
  2. Verknüpfung zwischen technischem Login und fachlichem Account prüfen.
- Erwartung:
  - Synchronisationsfehler oder fehlerhafte Verknüpfungen sind eindeutig erkennbar.

### S50 Support prüft konkrete Berechtigungsentscheidung

Bezug: Stories 120, 121

- Rolle: Support-Verantwortliche:r
- Schritte:
  1. Nutzer und konkrete Aktion auswählen.
  2. Berechtigungsprüfung ausführen.
- Erwartung:
  - Ergebnis erlaubt oder verboten ist eindeutig.
  - Eine fachlich verständliche Begründung ist sichtbar.
