require("dotenv").config();
const express = require("express");
const path = require("path");
const engine = require("ejs-mate");
const methodOverride = require("method-override");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------- VIEW ENGINE SETUP -----------------------
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (CSS + JS)
app.use(express.static(path.join(__dirname, "public")));

// --------------------- MIDDLEWARE ------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// --------------------- HELPERS --------------------------------
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidCode(code) {
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --------------------- HEALTH CHECK ----------------------------
app.get("/healthz", (req, res) => {
  res.json({ ok: true, version: "1.0" });
});

// --------------------- DASHBOARD -------------------------------
app.get("/", async (req, res) => {
  const search = req.query.q || "";
  try {
    let result;
    if (search) {
      const like = `%${search}%`;
      result = await db.query(
        "SELECT * FROM links WHERE code ILIKE $1 OR target_url ILIKE $1 ORDER BY created_at DESC",
        [like]
      );
    } else {
      result = await db.query("SELECT * FROM links ORDER BY created_at DESC");
    }

    res.render("dashboard", { links: result.rows, search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// --------------------- CREATE LINK -----------------------------
app.post("/api/links", async (req, res) => {
  let { url, code } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (code && !isValidCode(code)) {
    return res.status(400).json({ error: "Code must be 6–8 letters/numbers" });
  }

  if (!code) code = generateCode();

  try {
    const exists = await db.query("SELECT id FROM links WHERE code = $1", [code]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Code already exists" });
    }

    const insert = await db.query(
      "INSERT INTO links (code, target_url) VALUES ($1, $2) RETURNING *",
      [code, url]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- LIST LINKS ------------------------------
app.get("/api/links", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM links ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- GET LINK -------------------------------
app.get("/api/links/:code", async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query("SELECT * FROM links WHERE code = $1", [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- DELETE LINK -----------------------------
app.delete("/api/links/:code", async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query("DELETE FROM links WHERE code = $1", [code]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------- STATS PAGE ------------------------------
app.get("/code/:code", async (req, res) => {
  const { code } = req.params;
  try {
    const result = await db.query("SELECT * FROM links WHERE code = $1", [code]);

    if (result.rows.length === 0) {
      return res.status(404).send("Code not found");
    }

    res.render("stats", { link: result.rows[0], request: req });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// --------------------- REDIRECT ------------------------------
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  if (["api", "healthz", "code"].includes(code)) {
    return res.status(404).send("Not found");
  }

  try {
    const result = await db.query("SELECT * FROM links WHERE code = $1", [code]);

    if (result.rows.length === 0) {
      return res.status(404).send("Code not found");
    }

    const link = result.rows[0];

    await db.query(
      "UPDATE links SET total_clicks = total_clicks + 1, last_clicked_at = NOW() WHERE id = $1",
      [link.id]
    );

    res.redirect(302, link.target_url);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// --------------------- START SERVER ----------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
