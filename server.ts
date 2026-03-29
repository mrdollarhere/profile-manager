import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("profiles.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    proxyHost TEXT,
    proxyPort TEXT,
    proxyUsername TEXT,
    proxyPassword TEXT,
    fingerprint TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/profiles", (req, res) => {
    try {
      const profiles = db.prepare("SELECT * FROM profiles ORDER BY createdAt DESC").all();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.post("/api/profiles", (req, res) => {
    const { name, proxyHost, proxyPort, proxyUsername, proxyPassword, fingerprint } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    try {
      const info = db.prepare(`
        INSERT INTO profiles (name, proxyHost, proxyPort, proxyUsername, proxyPassword, fingerprint)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        name, 
        proxyHost || null, 
        proxyPort || null, 
        proxyUsername || null, 
        proxyPassword || null,
        fingerprint ? JSON.stringify(fingerprint) : null
      );
      
      const newProfile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(newProfile);
    } catch (error) {
      res.status(500).json({ error: "Failed to create profile" });
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
