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
  throw new Error("No browser found.");
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
  console.log("=== Diagnosing buffering/reloading issue ===");

  killPort(1234);
  killPort(3000);
  await new Promise((r) => setTimeout(r, 1000));

  console.log("1. Starting collab server...");
  const collabServer = spawn("node", ["collab-server/server.mjs"], { stdio: "pipe", shell: true });
  collabServer.stdout.on("data", (d) => console.log(`[collab] ${d.toString().trim()}`));
  collabServer.stderr.on("data", (d) => console.error(`[collab err] ${d.toString().trim()}`));

  console.log("2. Starting next dev...");
  const nextServer = spawn("npx", ["next", "dev", "-p", "3000"], { stdio: "pipe", shell: true });
  nextServer.stdout.on("data", (d) => {
    const s = d.toString().trim();
    if (!s.includes("Fast Refresh") && !s.includes("Compiling")) {
      console.log(`[next] ${s}`);
    }
  });
  nextServer.stderr.on("data", (d) => console.error(`[next err] ${d.toString().trim()}`));

  await waitForHttp("http://localhost:3000", 35000);
  console.log("Servers up!");

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: getBrowserPath(),
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    let reloads = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        reloads++;
        console.log(`[Navigation #${reloads}] ${frame.url()}`);
      }
    });

    page.on("console", (msg) => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });

    page.on("pageerror", (err) => {
      console.error(`[Browser PageError]`, err.message);
    });

    page.on("requestfailed", (req) => {
      console.error(`[Network Failed] ${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    console.log("Registering a new session to observe workspace behavior...");
    const ts = Date.now();
    await page.goto("http://localhost:3000/register", { waitUntil: "networkidle2" });
    await page.type("#register-name", `BufferTester ${ts}`);
    await page.type("#register-email", `buffertest_${ts}@example.com`);
    await page.type("#register-password", "Password123!");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    console.log(`Current URL after register: ${page.url()}`);
    console.log("Monitoring workspace page for 10 seconds to check for repeated buffering, reloads, or spinner loops...");
    
    for (let i = 1; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const hasSpinner = await page.$('svg.animate-spin');
      const wsStatus = await page.$eval('.sticky', (el) => el?.innerText || '').catch(() => 'no header');
      console.log(`  [Second ${i}] Spinner visible: ${!!hasSpinner} | Header text: ${wsStatus.replace(/\s+/g, ' ').substring(0, 60)}`);
    }

    console.log(`Total main-frame navigations during observation: ${reloads}`);
  } catch (err) {
    console.error("Diagnosis error:", err);
  } finally {
    if (browser) await browser.close();
    collabServer.kill();
    nextServer.kill();
    killPort(1234);
    killPort(3000);
  }
}
run();
