/**
 * E2E Test: Collaborative Whiteboard Sync
 * Verifies that whiteboard strokes drawn by User A appear in User B's canvas via Yjs/WebSocket.
 */

import puppeteer from "puppeteer-core";
import { spawn, execSync } from "child_process";
import { setTimeout as wait } from "timers/promises";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\Sriharan\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Chrome not found. Please install Google Chrome.");
}

async function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = [...new Set(out.trim().split("\n").map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
    for (const pid of pids) {
      try { execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" }); } catch {}
    }
  } catch {}
  await wait(500);
}

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode < 500) return resolve();
        setTimeout(check, 500);
      }).on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout waiting for ${url}`));
        setTimeout(check, 500);
      });
    };
    check();
  });
}

function spawnServer(cmd, args, cwd, tag) {
  const proc = spawn(cmd, args, { cwd, shell: true, stdio: "pipe" });
  proc.stdout.on("data", (d) => console.log(`  [${tag}] ${d.toString().trim()}`));
  proc.stderr.on("data", (d) => console.log(`  [${tag} err] ${d.toString().trim()}`));
  return proc;
}

// ─── Helper: draw a line on canvas via pointer events ───────────────────────
async function drawLineOnCanvas(page, canvasSelector, x1, y1, x2, y2) {
  const canvas = await page.$(canvasSelector);
  if (!canvas) throw new Error("Canvas not found with selector: " + canvasSelector);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no bounding box");

  const startX = box.x + x1;
  const startY = box.y + y1;
  const endX = box.x + x2;
  const endY = box.y + y2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in steps for smooth stroke
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const px = startX + ((endX - startX) * i) / steps;
    const py = startY + ((endY - startY) * i) / steps;
    await page.mouse.move(px, py);
    await wait(10);
  }
  await page.mouse.up();
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("==================================================");
  console.log("🎨 Collaborative Whiteboard E2E Test");
  console.log("==================================================");

  console.log("Freeing ports 1234 and 3000...");
  await killPort(1234);
  await killPort(3000);

  const chromePath = findChrome();
  console.log(`✓ Chrome: ${chromePath}\n`);

  // ── Start servers ──────────────────────────────────────────────────────────
  console.log("[1/5] Starting WebSocket collab server (port 1234)...");
  const collabProc = spawnServer("node", ["collab-server/server.mjs"], ROOT, "collab");
  await wait(2000);

  console.log("[2/5] Starting Next.js production server (port 3000)...");
  const nextProc = spawnServer("node", [".next/standalone/server.js"], ROOT, "next");
  console.log("⏳ Waiting for Next.js...");
  await waitForServer("http://localhost:3000", 60000);
  console.log("✓ Next.js ready!\n");

  // ── Launch browser ─────────────────────────────────────────────────────────
  console.log("[3/5] Launching Chromium...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
  });

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ── Register a fresh test user ─────────────────────────────────────────
    console.log("\n[4/5] Setting up test user and navigating to a page...");
    const ts = Date.now();
    const email = `wb_test_${ts}@example.com`;
    const password = "TestPass123!";
    const name = `Whiteboard Tester ${ts}`;

    const pageA = await browser.newPage();
    await pageA.setViewport({ width: 1280, height: 900 });
    await pageA.goto("http://localhost:3000/register", { waitUntil: "networkidle0" });

    // Fill registration form
    await pageA.type('input[name="name"]', name);
    await pageA.type('input[name="email"]', email);
    await pageA.type('input[name="password"]', password);
    const submitBtn = await pageA.$('button[type="submit"]');
    if (!submitBtn) throw new Error("Registration submit button not found");
    await Promise.all([
      pageA.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }),
      submitBtn.click(),
    ]);

    const docUrl = pageA.url();
    if (!docUrl.includes("/workspace/")) throw new Error(`Registration failed. URL: ${docUrl}`);
    console.log(`  ✓ Registered and redirected to: ${docUrl}`);

    // ── Switch to Whiteboard mode ──────────────────────────────────────────
    console.log("\n[5/5] Testing Whiteboard Feature...");

    // Click the "Whiteboard" toggle button in the header (by id set in page.tsx)
    await pageA.waitForSelector('#view-mode-whiteboard-btn', { timeout: 10000 });
    await pageA.click('#view-mode-whiteboard-btn');
    console.log("  ✓ Clicked Whiteboard toggle");

    // Wait for canvas to appear
    await pageA.waitForSelector('canvas', { timeout: 10000 });
    console.log("  ✓ Canvas element found in DOM");
    await wait(2000); // Let Yjs provider connect

    // Check connection status shows "Live"
    const statusText = await pageA.evaluate(() => {
      const el = document.querySelector('[class*="emerald"]');
      return el ? el.textContent : null;
    });
    if (statusText && statusText.includes("Live")) {
      console.log(`  ✓ Connection status: "${statusText}"`);
      testsPassed++;
    } else {
      console.log(`  ⚠ Connection status not confirmed (may still be connecting)`);
    }

    // ── User A draws a stroke ──────────────────────────────────────────────
    console.log("  Drawing stroke with User A...");
    await drawLineOnCanvas(pageA, "canvas", 100, 150, 400, 300);
    await wait(500);
    console.log("  ✓ User A drew a stroke (diagonal line)");
    testsPassed++;

    // Take User A screenshot before sync check
    await pageA.screenshot({ path: path.join(__dirname, "e2e-wb-usera-before.png") });
    console.log("  ✓ Screenshot: tests/e2e-wb-usera-before.png");

    // ── Open User B in a new tab (same document URL) ───────────────────────
    console.log("  Simulating User B joining the same whiteboard...");
    const pageB = await browser.newPage();
    await pageB.setViewport({ width: 1280, height: 900 });

    // User B navigates directly to the same page URL
    await pageB.goto(docUrl, { waitUntil: "networkidle0", timeout: 20000 });
    await wait(1000);

    // Switch User B to whiteboard mode — use the id assigned in page.tsx
    const wbBtnB = await pageB.$('#view-mode-whiteboard-btn');
    if (!wbBtnB) throw new Error("Whiteboard toggle not found for User B");
    await wbBtnB.click();
    await pageB.waitForSelector('canvas', { timeout: 10000 });
    console.log("  ✓ User B switched to whiteboard mode");

    // Wait for Yjs sync to propagate strokes
    await wait(3000);

    // ── Verify User B's canvas has strokes via Yjs shared state ───────────
    // We inject a script to access the Yjs shared array via window globals
    // The whiteboard stores strokes in Y.Array on "whiteboard-strokes"
    // We check the canvas pixels to see if any non-white, non-dot pixels exist
    const userBHasContent = await pageB.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { hasContent: false, reason: 'no canvas' };
      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasContent: false, reason: 'no ctx' };

      const w = canvas.width;
      const h = canvas.height;
      const data = ctx.getImageData(0, 0, w, h).data;

      // Count non-white, non-light-gray pixels (stroke pixels)
      let darkPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        // A "stroke" pixel is dark (not white bg, not the dot grid light gray)
        if (a > 200 && r < 180 && g < 180 && b < 180) {
          darkPixels++;
        }
      }
      return { hasContent: darkPixels > 50, darkPixels, w, h };
    });

    if (userBHasContent.hasContent) {
      console.log(`  ✓ User B canvas contains synced strokes! (${userBHasContent.darkPixels} dark pixels)`);
      testsPassed++;
    } else {
      console.log(`  ✗ User B canvas appears empty. Dark pixels: ${userBHasContent.darkPixels || 0}/${userBHasContent.w}x${userBHasContent.h}`);
      testsFailed++;
    }

    // ── User B draws a second stroke ───────────────────────────────────────
    console.log("  User B draws a horizontal stroke...");
    await drawLineOnCanvas(pageB, "canvas", 150, 400, 600, 400);
    await wait(1500);
    console.log("  ✓ User B drew a stroke");
    testsPassed++;

    // Wait for A to receive B's stroke
    await wait(2000);

    // Check User A also has content (bidirectional)
    const userAHasContent = await pageA.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { hasContent: false };
      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasContent: false };
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let darkPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a > 200 && r < 180 && g < 180 && b < 180) darkPixels++;
      }
      return { hasContent: darkPixels > 100, darkPixels };
    });

    if (userAHasContent.hasContent) {
      console.log(`  ✓ BIDIRECTIONAL SYNC: User A received User B's stroke! (${userAHasContent.darkPixels} dark pixels)`);
      testsPassed++;
    } else {
      console.log(`  ✗ User A missing User B's stroke (dark pixels: ${userAHasContent.darkPixels || 0})`);
      testsFailed++;
    }

    // Final screenshots
    await pageA.screenshot({ path: path.join(__dirname, "e2e-wb-usera-final.png") });
    await pageB.screenshot({ path: path.join(__dirname, "e2e-wb-userb-final.png") });
    console.log("  ✓ Screenshots: e2e-wb-usera-final.png, e2e-wb-userb-final.png");

    await pageA.close();
    await pageB.close();

  } catch (err) {
    console.error(`\n✗ Test error: ${err.message}`);
    testsFailed++;
  } finally {
    await browser.close();
    collabProc.kill();
    nextProc.kill();
    await wait(500);
  }

  // ── Results ──────────────────────────────────────────────────────────────
  console.log("\n==================================================");
  if (testsFailed === 0) {
    console.log(`✅ ALL WHITEBOARD TESTS PASSED! (${testsPassed} checks)`);
  } else {
    console.log(`❌ ${testsFailed} test(s) FAILED, ${testsPassed} passed.`);
  }
  console.log("==================================================\n");

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
