#!/usr/bin/env python3
"""Test session loading after OAuth callback"""
from playwright.sync_api import sync_playwright
import json

print("🧪 Testing session loading with Playwright...")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture console logs
    console_logs = []
    def handle_console(msg):
        console_logs.append(f"[{msg.type}] {msg.text}")
    page.on("console", handle_console)

    # Capture network requests and responses
    requests = []
    def handle_request(request):
        requests.append({
            'method': request.method,
            'url': request.url,
            'headers': dict(request.headers)
        })
    page.on("request", handle_request)

    responses = []
    def handle_response(response):
        if response.status >= 400:
            responses.append({
                'url': response.url,
                'status': response.status,
                'statusText': response.status_text
            })
    page.on("response", handle_response)

    # Navigate to the page after OAuth callback
    print("\n📍 Loading http://localhost:3000/?auth=ok")
    page.goto('http://localhost:3000/?auth=ok')

    # Wait for network idle
    print("⏳ Waiting for networkidle...")
    page.wait_for_load_state('networkidle', timeout=10000)

    # Take screenshot
    print("📸 Taking screenshot...")
    page.screenshot(path='/tmp/session-loading.png', full_page=True)

    # Wait a bit more for async operations
    page.wait_for_timeout(2000)

    # Check if session loaded
    print("\n🔍 Checking page content...")
    content = page.content()
    if "Lade Session" in content:
        print("❌ Session still loading (stuck on 'Lade Session ...')")
    else:
        print("✅ Session text changed (may have loaded)")

    # Print console logs
    print(f"\n📝 Console logs ({len(console_logs)} entries):")
    for log in console_logs:
        print(f"  {log}")

    # Check for /auth/me request
    print(f"\n🌐 Network requests ({len(requests)} total):")
    auth_me_requests = [r for r in requests if '/auth/me' in r['url']]
    if auth_me_requests:
        print(f"  ✅ Found {len(auth_me_requests)} request(s) to /auth/me")
        for req in auth_me_requests:
            print(f"    Method: {req['method']}")
            print(f"    Cookie: {req['headers'].get('cookie', '(none)')}")
    else:
        print("  ❌ No request to /auth/me found")

    browser.close()
    print("\n✅ Test complete. Screenshot: /tmp/session-loading.png")
