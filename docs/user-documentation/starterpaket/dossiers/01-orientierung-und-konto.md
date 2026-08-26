# Dossier 1: Orientierung und Konto

## Nutzerreise

Angemeldete Personen starten auf der Studio-Übersicht, öffnen je nach Berechtigung einen
Fachbereich und verwalten über das Kopfmenü Profil, Datenschutzvorgänge und Kontoregeln. Die
Kontoseiten sind Self-Service-Sichten; administrative IAM-Fälle werden separat im
Transparenz-Cockpit bearbeitet.

## `home.overview` – Studio-Übersicht

- **Route / Typ / Owner:** `/`, Übersicht, Host.
- **Nutzerziel:** Verfügbare Fachbereiche erkennen und eine häufige Aufgabe beginnen.
- **Produktfakten:** Die Seite zeigt für angemeldete Personen berechtigungs- und modulabhängige
  Aktionskarten für Nachricht, Veranstaltung, Medium und Benutzerverwaltung. Zusätzlich wird ein
  Studio-Changelog geladen. Für nicht angemeldete Personen steht die Anmeldung im Vordergrund.
- **Kontextabhängig:** Eine Aktionskarte erscheint nur bei passender Modulzuweisung und Aktion.
  Sitzungs- oder Rollenfehler können statt des normalen Einstiegs erscheinen.
- **Redaktionelle Leitfragen:** Warum fehlt eine erwartete Karte? Wo liegen Navigation,
  Organisationswechsel und Kontomenü? Was ist der Unterschied zwischen Changelog und Hilfe?
- **Stichwörter / Querverweise:** Übersicht, Startseite, Navigation, Anmeldung, Module,
  Berechtigung; weiter zu Inhalten, Medien, Konto und Benutzerverwaltung.
- **Evidenz:** `routes/-home-page.tsx`, `routes/-home-action-cards.tsx`,
  `i18n/resources/de/home.resources.ts`.

## `account.profile` – Mein Konto

- **Route / Typ / Owner:** `/account`, Übersicht, Host.
- **Nutzerziel:** Eigene Profildaten, Kontaktdaten und persönliche Einstellungen prüfen oder im
  zulässigen Kontext ändern.
- **Produktfakten:** Die Seite trennt Profilzusammenfassung und Formular. Plattform-Profile werden
  ausdrücklich nur lesbar dargestellt; Änderungen werden nicht über den tenantlokalen Profilpfad
  gespeichert. Erfolgs- und Fehlerzustände können Request-IDs ausgeben.
- **Kontextabhängig:** Bearbeitbarkeit hängt vom Plattform- oder Instanzprofil sowie der geladenen
  Sitzung ab.
- **Redaktionelle Leitfragen:** Welche Felder sind bearbeitbar? Wie erkennt man ein Plattformprofil?
  An wen wendet man sich bei nur lesbaren oder fehlenden Daten?
- **Stichwörter / Querverweise:** Mein Konto, Profil, persönliche Daten, Plattformprofil; weiter zu
  Datenschutz und Kontoregeln.
- **Evidenz:** `routes/account/-account-profile-page.tsx`,
  `routes/account/-account-profile-form.tsx`, `i18n/resources/de/account/`.

## `account.rules` – Kontoregeln

- **Route / Typ / Owner:** `/account/rules`, Übersicht, Host.
- **Nutzerziel:** Tenantweite Kontofristen verstehen und die Behandlung eigener Inhalte einstellen.
- **Produktfakten:** Angezeigt werden Fristen für Deaktivierung, Pseudonymisierung und finalen
  Tombstone-Soft-Delete sowie die Standardregel für Inhalte. Persönlich wählbar ist, ob eigene
  Inhalte beibehalten oder mit dem Konto-Lebenszyklus behandelt werden; die Auswahl wird separat
  gespeichert.
- **Kontextabhängig:** Eine persönliche Überschreibung kann tenantweit abgeschaltet sein. Die Seite
  ändert keine tenantweiten Fristen.
- **Redaktionelle Leitfragen:** Was bedeutet Tombstone-Soft-Delete? Ab welchem Ereignis laufen die
  Fristen? Wann gilt der Tenant-Standard statt der persönlichen Auswahl?
- **Stichwörter / Querverweise:** Kontolebenszyklus, Deaktivierung, Pseudonymisierung, Löschung,
  Inhaltsregel; weiter zum administrativen Tab „Löschregeln“.
- **Evidenz:** `routes/account/-account-rules-page.tsx`,
  `i18n/resources/de/account/rules.resources.ts`.

## `account.privacy` – Datenschutz und Transparenz

- **Route / Typ / Owner:** `/account/privacy`, Übersicht, Host.
- **Nutzerziel:** Eigene Datenschutzanfragen auslösen und deren Bearbeitungsstand verfolgen.
- **Produktfakten:** Angeboten werden Rechteänderung, Auskunft, Datenexport, Widerspruch,
  Löschanfrage und Einschränkung. Eine gemeinsame Aktivitätsliste lässt sich nach Suche, Status und
  Typ filtern; abgeschlossene Exporte können einen Download anbieten. Statuswerte sind eingeplant,
  in Bearbeitung, abgeschlossen, blockiert und fehlgeschlagen.
- **Kontextabhängig:** Verfügbare Aktionen und Downloads hängen vom Kontozustand und vom jeweiligen
  Fall ab. Der spielerische Faxdialog hat ausdrücklich keine Auswirkung auf die Anfrage.
- **Redaktionelle Leitfragen:** Welche Anfrage passt zu welchem Anliegen? Welche Angaben sind
  optional? Was bedeutet „blockiert“ und wer bearbeitet den Vorgang weiter?
- **Stichwörter / Querverweise:** Auskunft, Export, Widerspruch, Löschanfrage, Einschränkung,
  Datenschutzvorgang; weiter zum Falldetail.
- **Evidenz:** `routes/account/-account-privacy-page.tsx`,
  `routes/account/-account-privacy-action-cards.tsx`,
  `i18n/resources/de/account/privacy.resources.ts`.

## `account.privacy-detail` – Datenschutzfall-Detail

- **Route / Typ / Owner:** `/account/privacy/$caseId`, Detail, Host.
- **Nutzerziel:** Typ, Status und Metadaten eines eigenen Datenschutzvorgangs nachvollziehen.
- **Produktfakten:** Die Seite lädt einen einzelnen Eintrag anhand der Fall-ID und zeigt unter
  anderem Typ, Rohstatus, Erstellungs- und Abschlusszeit, Format sowie einen möglichen Blocker.
  Nicht gefundene Fälle und Ladefehler werden getrennt dargestellt.
- **Kontextabhängig:** Der tatsächliche Informationsumfang hängt vom Falltyp ab; nicht vorhandene
  Werte werden ausgelassen oder als nicht verfügbar angezeigt.
- **Redaktionelle Leitfragen:** Welche Statusänderung ist zu erwarten? Wann erscheint ein Download?
  Welche Fall-ID sollte bei einer Supportanfrage genannt werden?
- **Stichwörter / Querverweise:** Fall-ID, Bearbeitungsstatus, Blocker, Exportformat; zurück zur
  Datenschutzübersicht.
- **Evidenz:** `routes/account/-account-privacy-detail-page.tsx`,
  `routes/account/-account-privacy-shared.tsx`.
