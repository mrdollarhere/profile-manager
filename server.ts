import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { chromium, type BrowserServer, type BrowserContext } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("profiles.db");
const activeServers = new Map<number, BrowserServer>();
const activeContexts = new Map<number, BrowserContext>();

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    proxyHost TEXT,
    proxyPort TEXT,
    proxyUsername TEXT,
    proxyPassword TEXT,
    fingerprint TEXT,
    cookies TEXT,
    group_id INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/groups", (req, res) => {
    try {
      const groups = db.prepare("SELECT * FROM groups ORDER BY name ASC").all();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", (req, res) => {
    const { name, color } = req.body;
    if (!name || !color) {
      return res.status(400).json({ error: "Name and color are required" });
    }
    try {
      const info = db.prepare("INSERT INTO groups (name, color) VALUES (?, ?)").run(name, color);
      const newGroup = db.prepare("SELECT * FROM groups WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(newGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.get("/api/profiles", (req, res) => {
    try {
      const profiles = db.prepare("SELECT * FROM profiles ORDER BY createdAt DESC").all();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.post("/api/profiles", (req, res) => {
    const { name, proxyHost, proxyPort, proxyUsername, proxyPassword, fingerprint, group_id, cookies } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    try {
      const info = db.prepare(`
        INSERT INTO profiles (name, proxyHost, proxyPort, proxyUsername, proxyPassword, fingerprint, group_id, cookies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name, 
        proxyHost || null, 
        proxyPort || null, 
        proxyUsername || null, 
        proxyPassword || null,
        fingerprint ? JSON.stringify(fingerprint) : null,
        group_id || null,
        cookies ? JSON.stringify(cookies) : null
      );
      
      const newProfile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(newProfile);
    } catch (error) {
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  app.put("/api/profiles/:id", (req, res) => {
    const { id } = req.params;
    const { name, proxyHost, proxyPort, proxyUsername, proxyPassword, fingerprint, group_id } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    try {
      db.prepare(`
        UPDATE profiles 
        SET name = ?, proxyHost = ?, proxyPort = ?, proxyUsername = ?, proxyPassword = ?, fingerprint = ?, group_id = ?
        WHERE id = ?
      `).run(
        name,
        proxyHost || null,
        proxyPort || null,
        proxyUsername || null,
        proxyPassword || null,
        fingerprint ? JSON.stringify(fingerprint) : null,
        group_id || null,
        id
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.patch("/api/profiles/:id/cookies", (req, res) => {
    const { id } = req.params;
    const { cookies } = req.body;
    try {
      db.prepare("UPDATE profiles SET cookies = ? WHERE id = ?").run(
        cookies ? JSON.stringify(cookies) : null,
        id
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update cookies" });
    }
  });

  app.patch("/api/profiles/:id", (req, res) => {
    const { id } = req.params;
    const { group_id } = req.body;
    try {
      db.prepare("UPDATE profiles SET group_id = ? WHERE id = ?").run(group_id || null, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/profiles/:id", (req, res) => {
    const { id } = req.params;
    try {
      const result = db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  app.post("/api/proxies/check", async (req, res) => {
    const { proxyHost, proxyPort, proxyUsername, proxyPassword } = req.body;
    
    if (!proxyHost || !proxyPort) {
      return res.status(400).json({ error: "Proxy host and port are required" });
    }

    const proxy = {
      server: `${proxyHost}:${proxyPort}`,
      username: proxyUsername || undefined,
      password: proxyPassword || undefined,
    };

    const startTime = Date.now();
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ proxy });
      const page = await context.newPage();
      
      const response = await page.goto("https://ipinfo.io/json", { timeout: 10000 });
      if (!response || !response.ok()) {
        throw new Error(`Failed to connect: ${response?.status() || 'Unknown error'}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      res.json({
        ip: data.ip,
        country: data.country,
        city: data.city,
        latency,
      });
    } catch (error) {
      console.error("Proxy check error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Proxy connection failed" });
    } finally {
      if (browser) await browser.close();
    }
  });

  app.post("/api/profiles/:id/launch", async (req, res) => {
    const { id } = req.params;
    const profileId = parseInt(id);

    try {
      const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(profileId) as any;
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (activeServers.has(profileId)) {
        return res.status(400).json({ error: "Profile already launched" });
      }

      const fingerprint = profile.fingerprint ? JSON.parse(profile.fingerprint) : null;
      const proxy = profile.proxyHost ? {
        server: `${profile.proxyHost}:${profile.proxyPort}`,
        username: profile.proxyUsername || undefined,
        password: profile.proxyPassword || undefined,
      } : undefined;

      const browserServer = await chromium.launchServer({ 
        headless: false,
        proxy
      });
      const wsEndpoint = browserServer.wsEndpoint();
      const browser = await chromium.connect({ wsEndpoint });
      
      const context = await browser.newContext({
        userAgent: fingerprint?.userAgent,
        viewport: fingerprint ? { width: fingerprint.screenWidth, height: fingerprint.screenHeight } : undefined,
        timezoneId: fingerprint?.timezone,
        locale: fingerprint?.languages?.[0],
      });

      if (profile.cookies) {
        try {
          const cookies = JSON.parse(profile.cookies);
          await context.addCookies(cookies);
        } catch (e) {
          console.error("Failed to add cookies:", e);
        }
      }

      if (fingerprint) {
        await context.addInitScript((fp) => {
          // Spoof Navigator
          Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
          Object.defineProperty(navigator, 'languages', { get: () => fp.languages });
          
          // Spoof WebGL
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return fp.webglVendor; // UNMASKED_VENDOR_WEBGL
            if (parameter === 37446) return fp.webglRenderer; // UNMASKED_RENDERER_WEBGL
            return getParameter.apply(this, [parameter]);
          };

          // Canvas noise
          const getImageData = CanvasRenderingContext2D.prototype.getImageData;
          CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
            const imageData = getImageData.apply(this, [x, y, w, h]);
            const seed = fp.canvasSeed;
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] + (Math.sin(seed + i) * 2);
            }
            return imageData;
          };
        }, fingerprint);
      }

      activeServers.set(profileId, browserServer);
      activeContexts.set(profileId, context);
      
      const page = await context.newPage();
      await page.goto("https://browserleaks.com/ip");
      
      res.json({ wsEndpoint });
    } catch (error) {
      console.error("Launch error:", error);
      res.status(500).json({ error: "Failed to launch browser" });
    }
  });

  app.post("/api/profiles/:id/stop", async (req, res) => {
    const { id } = req.params;
    const profileId = parseInt(id);

    try {
      const server = activeServers.get(profileId);
      if (server) {
        await server.close();
        activeServers.delete(profileId);
        activeContexts.delete(profileId);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Session not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to stop browser" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
