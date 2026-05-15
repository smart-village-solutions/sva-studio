## 1. Specification

- [x] 1.1 Lokalen Dev-Auth-Modus als expliziten Entwicklervertrag beschreiben
- [x] 1.2 Neue Endpunkte `POST /auth/dev-login` und `POST /auth/dev-logout` festhalten
- [x] 1.3 Abgrenzung gegen OIDC-, Silent-SSO- und IAM-Produktivverhalten dokumentieren

## 2. Runtime und Routing

- [x] 2.1 Serverseitige Aktivierung über `SVA_DEV_AUTH` plus Legacy-Aliase ergänzen
- [x] 2.2 Explizite Dev-Auth-Session über Cookie statt globalem Always-Auth modellieren
- [x] 2.3 Neue Dev-Auth-Endpunkte in Auth-Runtime und Routing registrieren

## 3. Browser und UX

- [x] 3.1 Browserseitige Aktivierung über `VITE_SVA_DEV_AUTH` plus Legacy-Aliase ergänzen
- [x] 3.2 Shell und Startseite um expliziten Dev-Login-Button und sichtbare Kennzeichnung ergänzen
- [x] 3.3 Dev-Logout und Recovery-Verhalten an den lokalen Modus anpassen

## 4. Verification und Doku

- [x] 4.1 Unit-Tests für Auth-Runtime, Routing und React-Shell ergänzen oder aktualisieren
- [x] 4.2 Entwickler- und Architektur-Dokumentation für den lokalen Dev-Auth-Modus ergänzen
