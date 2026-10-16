# Dossier 8: Instanzen, Templates und Rechtstexte

## `admin.instances.list` – Instanzen verwalten

- **Route / Typ / Owner:** `/admin/instances`, Liste, Host.
- **Nutzerziel:** Registry-Einträge, Hostnamen und Lebenszyklus von Studio-Instanzen überblicken.
- **Produktfakten:** Die Liste führt Instanz-ID, Anzeigename, Hostname und Status zusammen und
  öffnet Detail oder Neuanlage. Provisioning- und Aktivierungszustände werden separat dargestellt.
- **Kontextabhängig:** Diese plattformnahe Verwaltung ist nicht mit der normalen Arbeit innerhalb
  einer ausgewählten Instanz gleichzusetzen.
- **Leitfragen / Stichwörter:** Welche Instanz ist aktiv oder noch im Aufbau? Welcher Hostname gehört
  dazu? Instanzliste, Registry, Hostname, Lebenszyklus.
- **Evidenz:** `routes/admin/instances/-instances-page.tsx`,
  `i18n/resources/de/admin/instances/`.

## `admin.instances.create` – Instanz anlegen

- **Route / Typ / Owner:** `/admin/instances/new`, Anlegen, Host.
- **Nutzerziel:** Instanz, Nutzer-Datenbank und Administratorprofil für eine neue Instanz vorbereiten.
- **Produktfakten:** Vier Schritte erfassen Instanzdaten, Realm-Auswahl, Administratorprofil und Review.
  Gruppen können direkt geändert werden; Readiness trennt Anlage-, Einrichtungs- und
  Aktivierungsblocker. Clients und Secrets folgen den bestehenden Provisioning-Defaults.
- **Folge:** Die Anlage startet denselben Provisioning-Vertrag wie der Ops-Pfad und führt danach in
  den Setup-Abschluss.
- **Leitfragen / Stichwörter:** Welche IDs sind dauerhaft? Welche Secrets werden erzeugt statt
  eingegeben? Instanz anlegen, Realm, Client, Tenant-Admin, Provisioning.
- **Evidenz:** `routes/admin/instances/-instance-create-page.tsx`,
  `i18n/resources/de/admin/instances/form.resources.ts`.

## `admin.instances.detail` – Instanz bearbeiten

- **Route / Typ / Owner:** `/admin/instances/$instanceId`, Detail, Host.
- **Nutzerziel:** Betrieb, Diagnose und Konfiguration einer Instanz steuern.
- **Produktfakten:** Hauptbereiche sind Betrieb, Doctor und Einstellungen. Die Seite bündelt
  eine kompakte Einrichtung mit einer nächsten Hauptaktion, Modulzeilen mit Aktivierung und
  Bereitschaft sowie Doctor-Maßnahmen mit aufklappbaren Belegen. Realm/Clients und Zugangsdaten
  sind in den Einstellungen aufklappbar. Die Einladungsvorlage speichert unabhängig vom
  ungespeicherten Einstellungsentwurf. Gespeicherte Secrets werden nie zurückgelesen.
- **Kontextabhängig:** Einzelne Reparatur-, Reconcile- oder Bootstrap-Aktionen benötigen besondere
  Rechte und bestätigte Betriebsdiagnose.
- **Leitfragen / Stichwörter:** Welche Ansicht beantwortet Status, Ursache oder Konfiguration? Wann
  ist eine Reparaturaktion zulässig? Instanzdetails, Doctor, Betrieb, Provisioning-Lauf, Module.
- **Evidenz:** `routes/admin/instances/-instance-detail-page.tsx` und zugehörige
  `-instance-detail-*-section.tsx`.

### Bus-API-Keys unter Betrieb

Nur persönliche Plattform-Superadmins mit `instance_registry_admin` auf dem Root-Host
können Bus-API-Keys verwalten. Tenant-Administratoren erhalten keinen Zugriff.
Der Bereich steht unter „IAM-Basis neu aufbauen“. „Key erstellen“ ist die erste Aktion
unten links, gefolgt von „Metadaten neu laden“.
Für Änderungen genügt eine normale interaktive Anmeldung mit geprüftem frischem
Keycloak-Zeitnachweis. Das bestehende Frischefenster beträgt standardmäßig zehn Minuten.
Ist es abgelaufen, führt „Erneut anmelden“ direkt hinter dem Fehlertext zur erforderlichen
erneuten Anmeldung; anschließend muss die gewünschte Aktion bewusst wiederholt werden.
Ort und Instanz-ID sind fest aus der Registry abgeleitet. Beim Erstellen werden die
Kontakt-E-Mail des Kunden, die eigenen Initialen und „Gültig bis einschließlich“ bestätigt.
Standard ist der 31. Dezember des beim Öffnen aktuellen Jahres in Europe/Berlin.
Der tatsächliche Ablauf ist der Beginn des Folgetags in UTC: 31. Dezember 2026 ergibt
1. Januar 2027 um 00:00 UTC. Historische Ablaufzeitpunkte bleiben exakt
angezeigt; alte Keys können ohne Ablaufdatum bestehen.

Den neuen Klartext-Key ausdrücklich kopieren und sicher im vorgesehenen Client hinterlegen.
Der Dialog zeigt nur den API-Key, keine zusätzliche Key-ID. Nach erfolgreichem Kopieren
über den Button schließt „Schließen“ den Dialog direkt. Andernfalls fragt es nach, ob
der Key kopiert wurde. „Ja, ich habe den API-Key kopiert“ schließt den Dialog;
„Nein, ich muss den API-Key noch kopieren“ führt zurück zur Anzeige desselben API-Keys.
Die Kopierbestätigung erscheint links neben den Buttons im reservierten Platz.
Schlägt das Kopieren fehl, erscheint die Fehlermeldung im Key-Dialog; der Wert kann
manuell übernommen werden, und beim Schließen bleibt die Rückfrage bestehen.
Nach dem Schließen oder Instanzwechsel ist keine erneute Anzeige möglich. Für Rotation
zuerst einen neuen Key erstellen, im Client verteilen und prüfen, dann den alten Key bewusst
mit Bestätigung sperren. Der Sperrdialog kennzeichnet die betroffene ID mit **Key-ID:**;
die Sperrbuttons verwenden die rote Variante. Reaktivieren verlängert das Ablaufdatum nicht und ist nur bei
gesperrten, noch gültigen Keys aktiver Instanzen möglich. Lesen und Sperren bleiben auch
für suspendierte und archivierte Instanzen verfügbar.

Bei unklarem Ausgang die neu geladenen Metadaten prüfen; ein Key kann trotz Timeout
bereits erstellt worden sein. Einen nicht nutzbaren Key bewusst sperren und ersetzen.
Bei unbestätigter Sperrung oder Reaktivierung nennt die Meldung die jeweilige Aktion;
vor einem erneuten Versuch den neu geladenen Key-Status prüfen.
Eine erfolgreiche Bus-Änderung mit Auditwarnung nicht wiederholen; die angezeigte Request-ID
ermöglicht die Klärung. Fehlende Bus-Konfiguration betrifft nur diesen Bereich.

## `admin.templates` – Systemweite Templates verwalten

- **Route / Typ / Owner:** `/admin/templates`, Detail, Host.
- **Nutzerziel:** Den Standardtext und das Ziel nach dem Passwortsetzen für neue Einladungen verwalten.
- **Produktfakten:** Betreff und Nachricht werden systemweit gespeichert. Instanzen ohne eigenen
  Text verwenden dieses Template; fehlt auch das System-Template, greift der eingebaute
  SVA-Standard. „Zurücksetzen“ entfernt nur das System-Template und aktiviert damit wieder den
  eingebauten Standard.
- **Einladungsziel:** Ohne Zielauswahl gilt Studio. Als systemweiter Standard kann
  KasselDIALOG gewählt werden; bei der Nutzeranlage ist eine abweichende
  Auswahl möglich. Erneutes Senden verwendet das am Konto gespeicherte Ziel.
- **Kontextabhängig:** Ein abweichendes Template an einer Instanz hat Vorrang. Änderungen werden
  beim nächsten Versand einer Einladung wirksam.
- **Leitfragen / Stichwörter:** Welcher Einladungstext gilt standardmäßig? Gibt es für die Instanz
  eine Abweichung? Templates, Einladung, E-Mail, Systemstandard, Vererbung.
- **Evidenz:** `routes/admin/templates/-templates-page.tsx`,
  `i18n/resources/de/admin/instances/invitation.resources.ts`.

## `admin.legal-texts.list` – Rechtstexte verwalten

- **Route / Typ / Owner:** `/admin/legal-texts`, Liste, Host.
- **Nutzerziel:** Rechtstextversionen, Sprachen, Status, Zielgruppen und Akzeptanzen überblicken.
- **Produktfakten:** Suche erfasst UUID, Name, Version, Sprache und Inhalt; Filter unterscheiden
  Entwurf, gültig und archiviert. Kennzahlen zeigen Gesamtversionen, gültige Versionen,
  Sprachvarianten und aktive Akzeptanzen.
- **Leitfragen / Stichwörter:** Welche Version und Sprache ist gültig? Für welche Rollen oder
  Gruppen gilt sie? Rechtstext, Version, Sprache, Zielgruppe, Akzeptanz.
- **Evidenz:** `routes/admin/legal-texts/-legal-texts-page.tsx`,
  `i18n/resources/de/admin/legalTexts.resources.ts`.

## `admin.legal-texts.create` – Rechtstext anlegen

- **Route / Typ / Owner:** `/admin/legal-texts/new`, Anlegen, Host.
- **Nutzerziel:** Eine neue sprach- und versionsbezogene Rechtstextfassung erstellen.
- **Produktfakten:** Felder sind Name, Version, Sprache, Status, Veröffentlichungszeitpunkt,
  Zielrollen, Zielgruppen und HTML-Inhalt. Der gemeinsame Richtext-Editor bietet Überschriften,
  Absätze, Listen, Links und Textformatierung. Über den Umschalter kann derselbe Inhalt wahlweise
  visuell oder als rohes HTML bearbeitet werden; beim Wechsel zurück wird das HTML bereinigt.
- **Validierung:** Eine gültige Version benötigt ein Veröffentlichungsdatum in Europe/Berlin; eine
  bereits vorhandene Kombination erzeugt einen Konflikt.
- **Leitfragen / Stichwörter:** Ist es eine neue Version oder Sprachvariante? Wer muss akzeptieren?
  Rechtstext anlegen, HTML, Zielrollen, Zielgruppen, veröffentlicht.
- **Evidenz:** `routes/admin/legal-texts/-legal-text-create-page.tsx`,
  `i18n/resources/de/admin/legalTexts.resources.ts`.

## `admin.legal-texts.detail` – Rechtstext bearbeiten

- **Route / Typ / Owner:** `/admin/legal-texts/$legalTextVersionId`, Detail, Host.
- **Nutzerziel:** Inhalt und Metadaten einer konkreten Rechtstextversion aktualisieren.
- **Produktfakten:** Bearbeitbar sind dieselben fachlichen Felder wie bei der Anlage. Löschen
  entfernt die Version dauerhaft; bereits dokumentierte Akzeptanzen bleiben unverändert bestehen.
  Die visuelle und die HTML-Ansicht stehen auch beim Bearbeiten zur Verfügung. Markierte gemischte
  Textformatierungen lassen sich über „Formatierung entfernen“ aufheben.
- **Leitfragen / Stichwörter:** Darf eine bereits gültige Fassung verändert werden oder ist eine
  neue Version nötig? Was bleibt nach dem Löschen nachweisbar? Rechtstext bearbeiten, Akzeptanz,
  Version löschen.
- **Evidenz:** `routes/admin/legal-texts/-legal-text-detail-page.tsx`,
  `routes/admin/legal-texts/-legal-text-detail-form.tsx`.
