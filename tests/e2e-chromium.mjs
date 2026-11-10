import puppeteer from "puppeteer-core";
import { spawn, execSync } from "child_process";
import fs from "fs";
import http from "http";

function killPort(port) {
  try {
    const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0" && !isNaN(parseInt(pid, 10))) {
        try {
          execSync(`taskkill /F /PID ${pid} >nul 2>&1`);
        } catch {}
      }
    }
  } catch {}
}

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

function getBrowserPath() {
  for (const path of CHROME_PATHS) {
    if (fs.existsSync(path)) return path;
  }
  throw new Error("No Chromium or Chrome browser executable found on system.");
}

function waitForHttp(url, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on("error", () => retry());
      req.end();
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

async function run() {
  console.log("==================================================");
  console.log("🚀 Starting Full E2E Chromium Browser Test Suite");
  console.log("==================================================");

  console.log("Freeing ports 1234 and 3000 if occupied...");
  killPort(1234);
  killPort(3000);
  await new Promise((r) => setTimeout(r, 1000));

  const browserPath = getBrowserPath();
  console.log(`✓ Using Chromium browser: ${browserPath}`);

  // 1. Start Collab WebSocket server
  console.log("\n[1/6] Launching WebSocket collaboration server (port 1234)...");
  const collabServer = spawn("node", ["collab-server/server.mjs"], {
    stdio: "pipe",
    shell: true,
  });

  collabServer.stdout.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.log(`  [collab] ${line}`);
  });
  collabServer.stderr.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.error(`  [collab err] ${line}`);
  });
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Start Next.js server
  console.log("\n[2/6] Launching Next.js production server (port 3000)...");
  const nextServer = spawn("npx", ["next", "start", "-p", "3000"], {
    stdio: "pipe",
    shell: true,
  });

  nextServer.stdout.on("data", (d) => {
    const line = d.toString().trim();
    if (line && !line.includes("Fast Refresh")) console.log(`  [next] ${line}`);
  });
  nextServer.stderr.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.error(`  [next err] ${line}`);
  });

  let browser;

  const cleanup = async () => {
    console.log("\n🧹 Cleaning up processes...");
    if (browser) {
      try { await browser.close(); } catch {}
    }
    try { collabServer.kill(); } catch {}
    try { nextServer.kill(); } catch {}
    killPort(1234);
    killPort(3000);
  };

  process.on("SIGINT", async () => { await cleanup(); process.exit(1); });
  process.on("SIGTERM", async () => { await cleanup(); process.exit(1); });

  try {
    console.log("⏳ Waiting for Next.js (http://localhost:3000) to respond...");
    await waitForHttp("http://localhost:3000", 30000);
    console.log("✓ Next.js server is ready!");

    // 3. Launch Chromium Browser
    console.log("\n[3/6] Launching Chromium browser instance...");
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width: 1280, height: 800 },
    });

    const pageA = await browser.newPage();
    pageA.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("error") || text.includes("Warning") || text.includes("Collab")) {
        console.log(`    [Browser Console User A] ${text}`);
      }
    });

    // 4. Test Home Page
    console.log("\n[4/6] Testing Home Page (http://localhost:3000)...");
    await pageA.goto("http://localhost:3000", { waitUntil: "networkidle2" });
    const pageTitle = await pageA.title();
    console.log(`  ✓ Home page loaded. Title: "${pageTitle}"`);

    // 5. Register a New User
    console.log("\n[5/6] Testing User Registration and Default Workspace Setup...");
    await pageA.goto("http://localhost:3000/register", { waitUntil: "networkidle2" });

    const timestamp = Date.now();
    const testEmail = `test_${timestamp}@example.com`;
    const testName = `Automated Tester ${timestamp}`;
    const testPassword = "Password123!";

    await pageA.waitForSelector("#register-name");
    await pageA.type("#register-name", testName);
    await pageA.type("#register-email", testEmail);
    await pageA.type("#register-password", testPassword);

    console.log(`  Submitting registration for ${testEmail}...`);
    await Promise.all([
      pageA.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
      pageA.click('button[type="submit"]'),
    ]);

    const postRegisterUrl = pageA.url();
    console.log(`  ✓ Redirected successfully to: ${postRegisterUrl}`);

    // If redirected to dashboard, navigate to workspace page
    let editorUrl = postRegisterUrl;
    if (postRegisterUrl.includes("/dashboard")) {
      console.log("  Navigating from dashboard to workspace...");
      await pageA.waitForSelector("a[href*='/workspace/']", { timeout: 10000 });
      await pageA.click("a[href*='/workspace/']");
      await pageA.waitForNavigation({ waitUntil: "networkidle2" });
      editorUrl = pageA.url();
      console.log(`  ✓ Opened workspace: ${editorUrl}`);
    }

    // 6. Test Collaborative Editor & Real-Time Sync
    console.log("\n[6/6] Testing Real-Time TipTap Editor & WebSocket Synchronization...");
    await pageA.waitForSelector(".tiptap", { timeout: 15000 });
    console.log("  ✓ TipTap Editor DOM initialized for User A.");

    // Focus and type content in User A's editor
    await pageA.click(".tiptap");
    const testSentence = "Verified full collaborative editing in Chromium!";
    await pageA.keyboard.type(testSentence, { delay: 30 });
    console.log(`  ✓ Typed full sentence into User A editor: "${testSentence}"`);

    // Verify immediately in User A's DOM
    const contentInA = await pageA.$eval(".tiptap", (el) => el.innerText);
    console.log(`  ✓ User A editor content in DOM: "${contentInA.trim()}"`);
    if (!contentInA.includes(testSentence)) {
      throw new Error(`User A typed text was not displayed! Expected: "${testSentence}", Found: "${contentInA.trim()}"`);
    }

    // Wait for collab server sync
    await new Promise((r) => setTimeout(r, 1500));

    // Open User B in a second browser tab/page
    console.log("  Simulating User B joining the same document...");
    const pageB = await browser.newPage();
    pageB.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("error") || text.includes("Collab")) {
        console.log(`    [Browser Console User B] ${text}`);
      }
    });

    await pageB.goto(editorUrl, { waitUntil: "networkidle2" });
    await pageB.waitForSelector(".tiptap", { timeout: 15000 });
    console.log("  ✓ TipTap Editor DOM initialized for User B.");

    // Verify User B receives User A's text via CRDT / WebSocket
    await new Promise((r) => setTimeout(r, 2000));
    const contentInB = await pageB.$eval(".tiptap", (el) => el.innerText);
    console.log(`  ✓ User B received content over WebSocket: "${contentInB.trim()}"`);

    if (contentInB.includes(testSentence)) {
      console.log("  🎉 REAL-TIME SYNCHRONIZATION CONFIRMED ACROSS CLIENTS!");
    } else {
      throw new Error(`User B did not receive the synchronized sentence. Found: "${contentInB.trim()}"`);
    }

    // Test User B typing back
    await pageB.click(".tiptap");
    const userBSentence = " -> Synced back from User B!";
    await pageB.keyboard.type(userBSentence, { delay: 30 });
    await new Promise((r) => setTimeout(r, 1500));

    const finalContentInA = await pageA.$eval(".tiptap", (el) => el.innerText);
    console.log(`  ✓ User A received bidirectional sync from User B: "${finalContentInA.trim()}"`);
    if (!finalContentInA.includes("Synced back from User B!")) {
      throw new Error(`Bidirectional sync failed. Final User A content: "${finalContentInA.trim()}"`);
    }

    // Capture screenshot for visual confirmation
    await pageA.screenshot({ path: "tests/e2e-result-usera.png" });
    console.log("  ✓ Screenshot saved to tests/e2e-result-usera.png");

    console.log("\n==================================================");
    console.log("✅ ALL FULL FUNCTIONALITY CHROMIUM TESTS PASSED!");
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ E2E Test Failure:", err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    process.exit(process.exitCode || 0);
  }
}

run();

