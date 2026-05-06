## 1. Implementierung

- [x] 1.1 Auth-Runtime-Diagnostik um auth-spezifische `reason_code`-Fälle und sichere Zusatzfelder erweitern
- [x] 1.2 `/auth/me`- und Middleware-Fehler auf strukturierte `createApiError(...)`-Antworten umstellen
- [x] 1.3 Session-Auflösung um differenzierte Invalidierungsgründe für Reauth-/Expiry-Fälle ergänzen
- [x] 1.4 Browser-seitigen Auth-Diagnose-Trail mit `authFlowId` und `sessionStorage`-Ringpuffer einführen
- [x] 1.5 Home-/Session-Expired-Oberfläche um Diagnose-IDs erweitern
- [x] 1.6 Unit-Tests für Core-, Runtime- und Browserpfade ergänzen oder anpassen
- [x] 1.7 Betroffenen arc42-Abschnitt unter `docs/architecture/08-cross-cutting-concepts.md` aktualisieren
