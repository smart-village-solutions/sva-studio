# Git History Cleanup: Remove TLS Certificates

## Status

⚠️ **WARNING**: TLS certificate files were accidentally committed to Git in commit `1e1ad4c`:
- `dev/redis-tls/ca-key.pem` (PRIVATE KEY)
- `dev/redis-tls/ca.pem` (CA certificate)
- `dev/redis-tls/redis-key.pem` (PRIVATE KEY)
- `dev/redis-tls/redis.pem` (server certificate)

Even though these are **local self-signed dev certificates**, they should NEVER be in version control.

---

## Cleanup Steps (Before Pushing to Github)

### Option 1: Using git filter-repo (Recommended - Cleaner)

**Install git-filter-repo:**
```bash
# macOS
brew install git-filter-repo

# Ubuntu/Debian
sudo apt-get install git-filter-repo

# Or direct from source
git clone https://github.com/newren/git-filter-repo.git
sudo install -m 0755 git-filter-repo/git-filter-repo /usr/local/bin/
```

**Clean the history:**
```bash
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio

# Create a backup branch first
git branch backup-before-cleanup

# Remove the files from ALL history
git filter-repo --path dev/redis-tls --invert-paths --force

# This will:
# - Remove all .pem files from ALL commits
# - Rewrite entire history starting from first commit
# - Delete the files from working directory
```

**Verify cleanup:**
```bash
git log --all --full-history -- dev/redis-tls
# Should return: (empty - no results)

git log --all --full-history -- "*.pem"
# Should return: (empty - no results)
```

**Force push to remote (if already pushed):**
```bash
git push origin feature/redis-session-store-security --force-with-lease
```

**⚠️ WARNING**: This rewrites history! Only do this if:
1. Branch is NOT yet merged to `main`
2. No one else has based work on this branch
3. You have a backup

---

### Option 2: Using BFG Repo-Cleaner (Alternative)

**Install BFG:**
```bash
# macOS
brew install bfg

# Or download from: https://rtyley.github.io/bfg-repo-cleaner/
```

**Protect branches you want to keep:**
```bash
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio
git fetch origin

# Do NOT clean main branch
git reflog expire --expire=now --all && git gc --prune=now
```

**Remove the files:**
```bash
# Create .bfg-config
cat > .bfg-config.txt << 'EOF'
*.pem
*.key
*.crt
EOF

# Run BFG
bfg --delete-files .bfg-config.txt

# Cleanup
git reflog expire --expire=now --all && git gc --prune=now
```

---

## Prevention for Future

### 1. ✅ Already Done: Update .gitignore
```bash
# Certificates
*.pem
*.crt
*.key
dev/redis-tls/
```

### 2. Generate Certs Locally (Per Developer)

Create a setup script for developers:

**`dev/generate-tls-certs.sh`:**
```bash
#!/bin/bash

set -e

CERT_DIR="dev/redis-tls"
mkdir -p "$CERT_DIR"

echo "Generating self-signed TLS certificates for local Redis..."

# Generate CA private key
openssl genrsa -out "$CERT_DIR/ca-key.pem" 2048

# Generate CA certificate
openssl req -new -x509 -days 365 -key "$CERT_DIR/ca-key.pem" \
  -out "$CERT_DIR/ca.pem" \
  -subj "/C=DE/ST=NRW/L=Local/O=SVA-Dev/CN=redis-ca"

# Generate Redis server private key
openssl genrsa -out "$CERT_DIR/redis-key.pem" 2048

# Generate Redis server CSR
openssl req -new -key "$CERT_DIR/redis-key.pem" \
  -out "$CERT_DIR/redis.csr" \
  -subj "/C=DE/ST=NRW/L=Local/O=SVA-Dev/CN=localhost"

# Sign the server cert with CA
openssl x509 -req -days 365 -in "$CERT_DIR/redis.csr" \
  -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca-key.pem" \
  -CAcreateserial -out "$CERT_DIR/redis.pem"

# Cleanup CSR (not needed)
rm "$CERT_DIR/redis.csr"

echo "✅ Certificates generated in $CERT_DIR/"
ls -la "$CERT_DIR/"
```

**Usage:**
```bash
chmod +x dev/generate-tls-certs.sh
./dev/generate-tls-certs.sh
```

### 3. Add to Setup Documentation

In `README.md` or development guide:
```markdown
## Local Development Setup

### Redis TLS Setup

1. Generate local TLS certificates:
   ```bash
   ./dev/generate-tls-certs.sh
   ```

2. Certificates are generated in `dev/redis-tls/` (ignored by Git)

3. Start Redis with TLS:
   ```bash
   docker-compose up -d redis
   redis-cli -h localhost -p 6380 --cacert dev/redis-tls/ca.pem ping
   ```
```

---

## Timeline

| Date | Event | Status |
|------|-------|--------|
| 2026-02-04 | Certs committed in 1e1ad4c | 🔴 Leaked |
| 2026-02-04 | Added to .gitignore | ✅ Fixed locally |
| 2026-02-04 | Removed from working dir | ✅ Fixed locally |
| TBD | Run git filter-repo | ⏳ Pending |
| TBD | Force-push cleaned history | ⏳ Pending |

---

## Do NOT Do This

❌ **DON'T** push certificates to public repositories
❌ **DON'T** commit .pem/.key files to version control
❌ **DON'T** share private keys (ca-key.pem, redis-key.pem) in chat/docs
❌ **DON'T** regenerate from leaked keys - generate fresh ones

---

## References

- [git-filter-repo Documentation](https://htmlpreview.github.io/?https://github.com/newren/git-filter-repo/blob/docs/html/git-filter-repo.html)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [OWASP: Sensitive Data Exposure](https://owasp.org/www-project-top-ten/)

---

**Generated:** 4. Februar 2026
**Risk Level:** 🟡 Low (self-signed dev certs, not production keys)
**Action Required:** Before merging to main or pushing to public repo
