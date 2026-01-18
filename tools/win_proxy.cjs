const fs = require("fs");
const net = require("net");

const targetHost = process.argv[2];
const webPort = Number(process.argv[3] || 15173);
const apiPort = Number(process.argv[4] || 18000);
const logPath = process.argv[5];

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  if (logPath) {
    try {
      fs.appendFileSync(logPath, line);
    } catch {
      // ignore logging failure
    }
  } else {
    process.stdout.write(line);
  }
};

if (!targetHost) {
  log("Usage: node win_proxy.cjs <wsl_ip> [webPort] [apiPort] [logPath]");
  process.exit(1);
}

const proxy = (listenPort, targetPort) => {
  const test = net.connect(targetPort, targetHost);
  test.on("connect", () => {
    log(`target ok ${targetHost}:${targetPort}`);
    test.destroy();
  });
  test.on("error", (err) => {
    log(`target fail ${targetHost}:${targetPort} ${err.message}`);
  });

  const server = net.createServer((socket) => {
    const target = net.connect(targetPort, targetHost);
    socket.pipe(target);
    target.pipe(socket);
    const close = () => {
      socket.destroy();
      target.destroy();
    };
    socket.on("error", close);
    target.on("error", close);
  });
  server.on("error", (err) => {
    log(`proxy ${listenPort}->${targetHost}:${targetPort} error: ${err.message}`);
  });
  server.listen(listenPort, "127.0.0.1", () => {
    log(`proxy ${listenPort} -> ${targetHost}:${targetPort}`);
  });
};

proxy(webPort, 5173);
proxy(apiPort, 8000);
