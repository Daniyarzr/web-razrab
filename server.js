const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Rider_123";

const dataDir = path.join(__dirname, "data");
const publicDir = path.join(__dirname, "public");
const uploadsDir = path.join(publicDir, "uploads");
const contentPath = path.join(dataDir, "content.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.json({ limit: "12mb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "portfolio-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }
});

function getDefaultContent() {
  return {
    hero: {
      name: "Ваше имя",
      title: "Разработчик сайтов, таплинков, лендингов и Telegram-ботов",
      subtitle:
        "Создаю чистые, быстрые и конверсионные digital-решения для бизнеса и личных проектов.",
      avatar: "/uploads/default-avatar.svg"
    },
    about: {
      heading: "Кто я",
      text:
        "Я веб-разработчик. Делаю сайты-визитки, лендинги, taplink-страницы и Telegram-ботов с акцентом на результат: заявки, продажи, автоматизацию."
    },
    services: [
      "Сайты-визитки",
      "Лендинги под рекламу",
      "Taplink-страницы",
      "Telegram-боты",
      "Индивидуальные web-решения"
    ],
    contacts: {
      telegram: "@your_telegram",
      email: "you@example.com",
      phone: "+7 (900) 000-00-00"
    },
    portfolio: [
      {
        id: "p1",
        title: "Лендинг для услуги",
        description:
          "Одностраничный сайт с продуманной структурой и акцентом на конверсию.",
        images: ["/uploads/default-project-1.svg"],
        link: ""
      },
      {
        id: "p2",
        title: "Telegram-бот для заявок",
        description: "Автоматизация приема заявок и уведомлений в реальном времени.",
        images: ["/uploads/default-project-2.svg"],
        link: ""
      }
    ]
  };
}

function ensureContentFile() {
  if (!fs.existsSync(contentPath)) {
    fs.writeFileSync(contentPath, JSON.stringify(getDefaultContent(), null, 2), "utf-8");
  }
}

function safeParseJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function normalizePortfolioItem(rawItem) {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};
  const fromArray = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const legacy = typeof item.image === "string" && item.image ? [item.image] : [];
  const images = fromArray.length ? fromArray : legacy;

  return {
    id: item.id || `p-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    title: item.title || "Проект",
    description: item.description || "",
    images,
    image: images[0] || "",
    link: item.link || ""
  };
}

function normalizeContent(rawContent) {
  const defaults = getDefaultContent();
  const content = rawContent && typeof rawContent === "object" ? rawContent : {};

  const portfolioRaw = Array.isArray(content.portfolio) ? content.portfolio : defaults.portfolio;
  const portfolio = portfolioRaw.map(normalizePortfolioItem);

  return {
    hero: { ...defaults.hero, ...(content.hero || {}) },
    about: { ...defaults.about, ...(content.about || {}) },
    services: Array.isArray(content.services) ? content.services.filter(Boolean) : defaults.services,
    contacts: { ...defaults.contacts, ...(content.contacts || {}) },
    portfolio
  };
}

function readContent() {
  ensureContentFile();
  let raw;

  try {
    raw = safeParseJsonFile(contentPath);
  } catch (error) {
    const brokenPath = path.join(dataDir, `content.broken-${Date.now()}.json`);
    const brokenText = fs.readFileSync(contentPath, "utf-8");

    fs.writeFileSync(brokenPath, brokenText, "utf-8");
    raw = getDefaultContent();
    fs.writeFileSync(contentPath, JSON.stringify(raw, null, 2), "utf-8");

    console.error(
      `Invalid JSON in ${contentPath}. Backup saved to ${brokenPath}. File restored to defaults.`
    );
  }

  const normalized = normalizeContent(raw);

  const rawAsJson = JSON.stringify(raw);
  const normalizedAsJson = JSON.stringify(normalized);
  if (rawAsJson !== normalizedAsJson) {
    fs.writeFileSync(contentPath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  return normalized;
}

function writeContent(content) {
  const normalized = normalizeContent(content);
  fs.writeFileSync(contentPath, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ ok: false, message: "Unauthorized" });
}

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  Object.values(interfaces).forEach((ifaceList) => {
    (ifaceList || []).forEach((iface) => {
      if (iface && iface.family === "IPv4" && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    });
  });

  return Array.from(new Set(urls));
}

app.use(express.static(publicDir));

app.get("/api/content", (_, res) => {
  res.json(readContent());
});

app.get("/api/admin/session", (req, res) => {
  res.json({ ok: true, authenticated: Boolean(req.session && req.session.isAdmin) });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "Неверный пароль" });
  }
  req.session.isAdmin = true;
  return res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.put("/api/admin/content", requireAdmin, (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ ok: false, message: "Некорректные данные" });
  }

  const current = readContent();
  const updated = writeContent({
    ...current,
    ...payload,
    hero: { ...current.hero, ...(payload.hero || {}) },
    about: { ...current.about, ...(payload.about || {}) },
    contacts: { ...current.contacts, ...(payload.contacts || {}) },
    services: Array.isArray(payload.services) ? payload.services : current.services,
    portfolio: Array.isArray(payload.portfolio) ? payload.portfolio : current.portfolio
  });

  return res.json({ ok: true, content: updated });
});

app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "Файл не загружен" });
  return res.json({
    ok: true,
    path: `/uploads/${req.file.filename}`
  });
});

app.post("/api/admin/uploads", requireAdmin, upload.array("images", 12), (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ ok: false, message: "Файлы не загружены" });
  }

  return res.json({
    ok: true,
    paths: files.map((f) => `/uploads/${f.filename}`)
  });
});

app.post("/api/admin/portfolio", requireAdmin, (req, res) => {
  const { title, description, images, image, link } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({ ok: false, message: "Заполните title и description" });
  }

  const normalizedImages = Array.isArray(images)
    ? images.filter(Boolean)
    : image
      ? [image]
      : [];

  const content = readContent();
  const item = normalizePortfolioItem({
    id: `p-${Date.now()}`,
    title,
    description,
    images: normalizedImages,
    link: link || ""
  });

  content.portfolio.unshift(item);
  const saved = writeContent(content);

  return res.json({ ok: true, item: saved.portfolio[0] });
});

app.put("/api/admin/portfolio/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const content = readContent();
  const index = content.portfolio.findIndex((x) => x.id === id);

  if (index === -1) {
    return res.status(404).json({ ok: false, message: "Проект не найден" });
  }

  const nextItem = normalizePortfolioItem({
    ...content.portfolio[index],
    ...(req.body || {})
  });

  content.portfolio[index] = nextItem;
  const saved = writeContent(content);

  return res.json({ ok: true, item: saved.portfolio[index] });
});

app.delete("/api/admin/portfolio/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const content = readContent();
  const before = content.portfolio.length;

  content.portfolio = content.portfolio.filter((x) => x.id !== id);
  if (content.portfolio.length === before) {
    return res.status(404).json({ ok: false, message: "Проект не найден" });
  }

  writeContent(content);
  return res.json({ ok: true });
});

app.get("/admin", (_, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("*", (_, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

function startServer(bindHost, allowFallback) {
  const server = app.listen(PORT, bindHost, () => {
    ensureContentFile();
    console.log(`Server started on http://localhost:${PORT}`);

    if (bindHost === "0.0.0.0") {
      const lanUrls = getLanUrls(PORT);
      lanUrls.forEach((url) => console.log(`LAN: ${url}`));
    }
  });

  server.on("error", (error) => {
    if (allowFallback && error && error.code === "EACCES") {
      console.warn(
        `Cannot bind ${bindHost}:${PORT}. Falling back to http://127.0.0.1:${PORT}`
      );
      startServer("127.0.0.1", false);
      return;
    }

    console.error(error);
    process.exit(1);
  });
}

startServer(HOST, HOST === "0.0.0.0");

