## 1. Implementation
- [x] 1.1 Auth-Runtime auf expliziten Opt-in fuer `SVA_TRUST_FORWARDED_HEADERS` umstellen.
- [x] 1.2 Regressionstests fuer fail-closed Default, ungueltige Env-Werte und Downstream-Debug-Header ergaenzen.
- [x] 1.3 Relevante Unit- und Type-Checks fuer `auth-runtime` ausfuehren.

## 2. Specification
- [x] 2.1 `iam-core` um den expliziten Reverse-Proxy-Trust-Vertrag fuer Forwarded-Header ergaenzen.
- [x] 2.2 `openspec validate update-forwarded-header-trust-opt-in --strict` erfolgreich ausfuehren.
