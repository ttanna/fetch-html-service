import express from "express";
import puppeteer from "puppeteer-core";

const app = express();
app.use(express.json({ limit: "1mb" }));

const REQUIRED_API_KEY = process.env.API_KEY || null;

app.post("/api/fetch-html", async (req, res) => {
  const { url } = req.body;

  if (!REQUIRED_API_KEY)
    return res.status(500).json({ error: "Server misconfigured: API key missing." });

  const provided = req.header("x-api-key");
  if (!provided || provided !== REQUIRED_API_KEY)
    return res.status(403).json({ error: "Forbidden - invalid API key" });

  if (!url || !/^https?:\/\//i.test(url))
    return res.status(400).json({ error: "Missing or invalid URL" });

  const execPath = process.env.CHROME_PATH || "/usr/bin/chromium";
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check"
      ]
    });

    const page = await browser.newPage();

    // Block heavy resources to speed things up
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Go quickly, don't wait for all requests
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

    // Wait up to 15 seconds for the concerts section
    try {
      await page.waitForSelector("ytmusic-ticket-shelf-renderer", { timeout: 15000 });
      console.log("✅ Ticket shelf element detected");
    } catch {
      console.warn("⚠️ Ticket shelf not found in 15s; capturing partial HTML");
    }

    // Give 5 more seconds for JS injection
    await page.waitForTimeout(5000);

    const html = await page.content();
    await page.close();
    await browser.close();

    res.json({ html });
  } catch (err) {
    console.error("fetch-html error:", err);
    try { if (browser) await browser.close(); } catch {}
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ fetch-html running on port ${PORT}`));
