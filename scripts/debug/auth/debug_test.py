#!/usr/bin/env python3
"""Debug script to test http://localhost:3000/ and capture errors."""

import asyncio
from playwright.async_api import async_playwright, Page
import json
import sys

async def test_app():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Capture console messages
        console_messages = []
        page.on("console", lambda msg: console_messages.append({
            "type": msg.type,
            "text": msg.text
        }))

        # Capture network requests/responses
        network_errors = []
        async def on_response(response):
            if response.status >= 400:
                try:
                    body = await response.text()
                    network_errors.append({
                        "url": response.url,
                        "status": response.status,
                        "body": body[:500]  # First 500 chars
                    })
                except:
                    pass

        page.on("response", on_response)

        # Navigate to app
        print("🔄 Loading http://localhost:3000/...")
        try:
            await page.goto("http://localhost:3000/", wait_until="networkidle")
            print("✅ Page loaded successfully")
        except Exception as e:
            print(f"❌ Navigation failed: {e}")
            await browser.close()
            return

        # Wait a bit for any JS errors
        await asyncio.sleep(2)

        # Take screenshot
        await page.screenshot(path="screenshot.png")
        print("📸 Screenshot saved: screenshot.png")

        # Get page content
        content = await page.content()

        # Check for error indicators
        error_indicators = [
            "HTTPError",
            "500",
            "error",
            "Internal Server Error",
            "RunnerError"
        ]

        has_errors = any(indicator in content for indicator in error_indicators)

        print("\n📋 Debug Info:")
        print(f"   Page title: {await page.title()}")
        print(f"   URL: {page.url}")

        if console_messages:
            print(f"\n🖨️  Console Messages ({len(console_messages)}):")
            for msg in console_messages[-10:]:  # Last 10
                print(f"   [{msg['type']}] {msg['text'][:100]}")

        if network_errors:
            print(f"\n⚠️  Network Errors ({len(network_errors)}):")
            for err in network_errors:
                print(f"   {err['status']} {err['url']}")
                print(f"   Body: {err['body']}\n")

        if has_errors:
            print(f"\n❌ ERROR INDICATORS FOUND IN HTML")
            # Extract error section
            if "HTTPError" in content:
                idx = content.find("HTTPError")
                print(f"   Context: ...{content[max(0, idx-100):idx+200]}...")
        else:
            print(f"\n✅ No obvious error indicators found")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_app())
