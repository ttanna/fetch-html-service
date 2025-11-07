import express from "express";
import puppeteer from "puppeteer-core";

const app = express();
app.use(express.json({ limit: "1mb" }));

// SECURITY: simple API key check
const REQUIRED_API_KEY = process.env.API_KEY || null;

app.post("/api/fetch-html", async (req, res) => {
  try {
    if (!REQUIRED_API_KEY) {
      return res.status(500).json({ error: "Server misconfigured: API key missing." });
    }
    const provided = req.header("x-api-key");
    if (!provided || provided !== REQUIRED_API_KEY) {
      return res.status(403).json({ error: "Forbidden - invalid API key" });
    }

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url in body" });

    // Basic safety: allow only http(s) urls
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Invalid url" });
    }

    // Determine executable path (set in Dockerfile as CHROME_PATH)
    const execPath = process.env.CHROME_PATH || "/usr/bin/chromium-browser";

    // Launch puppeteer-core using the system chromium
    const browser = await puppeteer.launch({
      executablePath: execPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true
    });

    const page = await browser.newPage();

    // Set a common user agent so YouTube serves normal content
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" +
      " Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate and wait for network idle then wait additional 5s
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(5000); // give dynamic modules time to appear

    const html = await page.content();
    await browser.close();

    res.json({ html });
  } catch (err) {
    console.error("fetch-html error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ fetch-html running on port ${PORT}`));
