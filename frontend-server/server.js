const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = parseInt(process.env.PORT || "3000", 10);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const INDEX_HTML = path.join(__dirname, "public", "index.html");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Proxy /api/* requests to backend
  if (url.pathname.startsWith("/api/")) {
    const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
    try {
      const headers = { ...req.headers, host: new URL(BACKEND_URL).host };
      delete headers["connection"];

      const fetchRes = await fetch(backendUrl, {
        method: req.method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(req.method)
          ? await getBody(req)
          : undefined,
      });

      res.writeHead(fetchRes.status, {
        "Content-Type": fetchRes.headers.get("content-type") || "application/json",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });

      if (fetchRes.body) {
        const reader = fetchRes.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { res.end(); break; }
            res.write(value);
          }
        };
        pump();
      } else {
        const text = await fetchRes.text();
        res.end(text);
      }
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Backend unavailable", detail: err.message }));
    }
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "cowork-china-frontend" }));
    return;
  }

  // Serve index.html for everything else
  try {
    const html = fs.readFileSync(INDEX_HTML, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("index.html not found");
  }
});

function getBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CoWork China frontend serving on :${PORT}, proxying API to ${BACKEND_URL}`);
});
