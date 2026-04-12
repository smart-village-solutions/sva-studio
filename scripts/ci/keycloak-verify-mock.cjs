const http = require("node:http");

const port = Number.parseInt(process.env.PORT || "38080", 10);
const realm = process.env.KEYCLOAK_REALM || "sva-studio";
const normalizeBaseUrl = (value) => {
  let normalized = value;
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (req.method === "POST" && url.pathname === `/realms/${realm}/protocol/openid-connect/token`) {
    return json(res, 200, {
      access_token: "verify-token",
      token_type: "Bearer",
      expires_in: 300,
    });
  }

  if (req.method === "GET" && url.pathname === `/admin/realms/${realm}/roles`) {
    return json(res, 200, []);
  }

  if (req.method === "GET" && url.pathname === `/realms/${realm}/.well-known/openid-configuration`) {
    const baseUrl = normalizeBaseUrl(
      process.env.KEYCLOAK_BASE_URL || `http://${req.headers.host || `127.0.0.1:${port}`}`
    );
    return json(res, 200, {
      issuer: `${baseUrl}/realms/${realm}`,
      token_endpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
      authorization_endpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/auth`,
      end_session_endpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/logout`,
      jwks_uri: `${baseUrl}/realms/${realm}/protocol/openid-connect/certs`,
    });
  }

  return json(res, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0");
