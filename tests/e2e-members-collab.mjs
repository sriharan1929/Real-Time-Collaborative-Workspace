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
  throw new Error("No Chromium or Chrome browser executable found.");
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
  console.log("==========================================================");
  console.log("👥 Multi-User Shared Workspace Real-Time Sync E2E Test");
  console.log("==========================================================");

  console.log("Clearing ports 1234 and 3000...");
  killPort(1234);
  killPort(3000);
  await new Promise((r) => setTimeout(r, 1000));

  const browserPath = getBrowserPath();

  console.log("\n[1/5] Starting servers...");
  const collabServer = spawn("node", ["collab-server/server.mjs"], {
    stdio: "pipe",
    shell: true,
  });
  await new Promise((r) => setTimeout(r, 1500));

  const nextServer = spawn("npx", ["next", "start", "-p", "3000"], {
    stdio: "pipe",
    shell: true,
  });

  await waitForHttp("http://localhost:3000", 25000);
  console.log("✓ Servers ready!");

  let browserA;
  let browserB;

  const cleanup = async () => {
    console.log("\n🧹 Cleaning up...");
    if (browserA) try { await browserA.close(); } catch {}
    if (browserB) try { await browserB.close(); } catch {}
    try { collabServer.kill(); } catch {}
    try { nextServer.kill(); } catch {}
    killPort(1234);
    killPort(3000);
  };

  try {
    const timestamp = Date.now();
    const userA_email = `owner_${timestamp}@example.com`;
    const userB_email = `member_${timestamp}@example.com`;

    // 2. Launch two ISOLATED browser instances (User A & User B)
    console.log("\n[2/5] Launching isolated Chromium instances for User A and User B...");
    browserA = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width: 1280, height: 800 },
    });

    browserB = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width: 1280, height: 800 },
    });

    const pageA = await browserA.newPage();
    const pageB = await browserB.newPage();

    // 3. Register User A
    console.log("\n[3/5] Registering User A (Workspace Owner)...");
    await pageA.goto("http://localhost:3000/register", { waitUntil: "networkidle2" });
    await pageA.type("#register-name", "Owner Alice");
    await pageA.type("#register-email", userA_email);
    await pageA.type("#register-password", "Password123!");
    await Promise.all([
      pageA.waitForNavigation({ waitUntil: "networkidle2" }),
      pageA.click('button[type="submit"]'),
    ]);
    const sharedPageUrl = pageA.url();
    console.log(`  ✓ User A registered and navigated to: ${sharedPageUrl}`);

    // Register User B in separate browser
    console.log("  Registering User B (Collaborator)...");
    await pageB.goto("http://localhost:3000/register", { waitUntil: "networkidle2" });
    await pageB.type("#register-name", "Member Bob");
    await pageB.type("#register-email", userB_email);
    await pageB.type("#register-password", "Password123!");
    await Promise.all([
      pageB.waitForNavigation({ waitUntil: "networkidle2" }),
      pageB.click('button[type="submit"]'),
    ]);
    console.log(`  ✓ User B registered. User B initial personal workspace: ${pageB.url()}`);

    // 4. User A invites User B to User A's workspace
    console.log("\n[4/5] User A invites User B via Members modal...");
    await pageA.waitForSelector(".tiptap", { timeout: 15000 });
    // Click Members button
    const membersBtn = await pageA.waitForSelector('button[title="Workspace Members"]');
    await membersBtn.click();
    await pageA.waitForSelector('input[placeholder="colleague@company.com"]');
    await pageA.type('input[placeholder="colleague@company.com"]', userB_email);
    // Click Add Member
    const addBtn = await pageA.waitForSelector('button[type="submit"]');
    await addBtn.click();
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`  ✓ User B (${userB_email}) invited successfully!`);

    // Close members modal
    const closeBtn = await pageA.$('button[title="Close modal"]');
    if (closeBtn) await closeBtn.click();

    // 5. User B navigates to User A's shared page directly
    console.log("\n[5/5] Testing real-time cross-user text synchronization...");
    console.log(`  User B opens User A's shared page: ${sharedPageUrl}`);
    await pageB.goto(sharedPageUrl, { waitUntil: "networkidle2" });
    await pageB.waitForSelector(".tiptap", { timeout: 15000 });
    console.log("  ✓ Both users are now active on the shared document!");

    // User A types in real time
    await pageA.click(".tiptap");
    const liveTextFromA = "Realtime update from Alice!";
    await pageA.keyboard.type(liveTextFromA, { delay: 40 });
    console.log(`  ✓ User A typed live: "${liveTextFromA}"`);

    // Verify User B sees it live in DOM
    await new Promise((r) => setTimeout(r, 2000));
    const textInB = await pageB.$eval(".tiptap", (el) => el.innerText);
    console.log(`  ✓ Text visible on User B's screen: "${textInB.trim()}"`);

    if (!textInB.includes(liveTextFromA)) {
      throw new Error(`Realtime sync failed! User B did not see "${liveTextFromA}". Found: "${textInB.trim()}"`);
    }
    console.log("  🎉 CONFIRMED: User A's text appeared live in User B's view!");

    // User B types back
    await pageB.click(".tiptap");
    const liveTextFromB = " Received and synced back by Bob!";
    await pageB.keyboard.type(liveTextFromB, { delay: 40 });
    console.log(`  ✓ User B typed live: "${liveTextFromB}"`);

    // Verify User A sees it live in DOM
    await new Promise((r) => setTimeout(r, 2000));
    const textInA = await pageA.$eval(".tiptap", (el) => el.innerText);
    console.log(`  ✓ Text visible on User A's screen: "${textInA.trim()}"`);

    if (!textInA.includes("synced back by Bob")) {
      throw new Error(`Bidirectional sync failed! User A did not see Bob's response.`);
    }
    console.log("  🎉 CONFIRMED: Bob's text appeared live on Alice's screen!");

    await pageA.screenshot({ path: "tests/cross-user-sync-success.png" });
    console.log("\n==========================================================");
    console.log("✅ FULL CROSS-USER SHARED WORKSPACE SYNC VERIFIED!");
    console.log("==========================================================");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    process.exit(process.exitCode || 0);
  }
}

run();

