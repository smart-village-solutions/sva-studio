# Dossier 4: Kategorien und Module

## `categories.overview` – Kategorien

- **Route / Typ / Owner:** `/categories`, Übersicht, Plugin `categories`.
- **Nutzerziel:** Mainserver-Kategorien und ihre Hierarchie prüfen.
- **Produktfakten:** Die aktuelle Seite ist schreibgeschützt. Sie zeigt eine flache Tabelle mit
  Name, ID, Hierarchie, Position und Tags. Bearbeiten, Unterkategorie anlegen und Löschen sind zwar
  sichtbar, aber deaktiviert. Die Liste kann neu geladen werden.
- **Kontextabhängig:** Laden erfordert `categories.read`, aktive Mainserver-Integration und passende
  persönliche oder organisatorische Credentials.
- **Redaktionelle Leitfragen:** Wie liest man die flache Hierarchiedarstellung? Wo werden Kategorien
  derzeit tatsächlich gepflegt? Welche Credentials fehlen bei einer leeren oder fehlerhaften Sicht?
- **Stichwörter / Querverweise:** Kategorie, Hierarchie, Tags, Mainserver, schreibgeschützt; weiter zu
  Inhaltstypen mit Kategorieauswahl.
- **Evidenz:** `packages/plugin-categories/src/categories.pages.tsx`,
  `packages/plugin-categories/src/plugin.translations.ts`.

## `modules.overview` – Module

- **Route / Typ / Owner:** `/modules`, Übersicht, Host.
- **Nutzerziel:** Modulfreigaben einer Instanz prüfen oder administrativ verwalten.
- **Produktfakten:** Im Tenantkontext zeigt die Seite alle bekannten Module mit aktivem oder
  inaktivem Status und Beschreibung. Ohne tenantgebundene Sitzung kann eine Instanz gewählt und
  deren Module zugewiesen oder entzogen werden; zusätzlich bestehen Aktionen zum Neuaufbau der
  IAM-Basis und zur Initialisierung der Tenant-Admin-Struktur.
- **Kontextabhängig:** Die Verwaltungsansicht benötigt Instanz- und Modulrechte. Beim Entziehen
  werden zugehörige Berechtigungen und IAM-Basis entfernt.
- **Redaktionelle Leitfragen:** Wann sieht man die reine Statusansicht? Was bewirkt Modulzuweisung im
  Unterschied zu Rollenrechten? Wann ist ein Neuaufbau der IAM-Basis fachlich zulässig?
- **Stichwörter / Querverweise:** Instanzmodul, Fachbereich, IAM-Basis, zuweisen, entziehen;
  weiter zu Instanzdetails, Rollen und Berechtigungen.
- **Evidenz:** `routes/admin/modules/-modules-page.tsx`,
  `i18n/resources/de/admin/instances/instanceModules.resources.ts`.
