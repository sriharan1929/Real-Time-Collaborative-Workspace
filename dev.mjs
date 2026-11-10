import { spawn } from "child_process";

console.log("Starting Docker containers (PostgreSQL & Redis)...");

const docker = spawn("docker", ["compose", "up", "-d"], {
  stdio: "inherit",
  shell: true,
});

docker.on("close", (code) => {
  if (code !== 0) {
    console.warn("Docker compose was skipped or exited with code", code);
  }
  startServers();
});

docker.on("error", () => {
  console.warn("Docker not detected or not running. Continuing with servers...");
  startServers();
});

function startServers() {
  console.log("Starting WebSocket Collaboration Server and Next.js Frontend...\n");

  const collab = spawn("node", ["collab-server/server.mjs"], {
    stdio: "inherit",
    shell: true,
  });

  const next = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  const cleanExit = () => {
    try {
      collab.kill();
      next.kill();
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", cleanExit);
  process.on("SIGTERM", cleanExit);
}
