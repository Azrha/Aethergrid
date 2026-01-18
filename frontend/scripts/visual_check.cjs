const puppeteer = require("puppeteer");

const clickByText = async (page, selector, text) => {
  return page.$$eval(selector, (nodes, t) => {
    const target = nodes.find((n) => n.textContent && n.textContent.trim().includes(t));
    if (target && target.click) {
      target.click();
      return true;
    }
    return false;
  }, text);
};

const selectByLabel = async (page, labelText, value) => {
  return page.evaluate((labelTextInner, valueInner) => {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((l) => (l.textContent || "").trim() === labelTextInner);
    if (!label) return false;
    const select = label.nextElementSibling;
    if (!select || select.tagName.toLowerCase() !== "select") return false;
    select.value = valueInner;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, labelText, value);
};

const waitForCanvasDraw = async (page, timeoutMs = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return true;
      const w = Math.min(32, canvas.width);
      const h = Math.min(32, canvas.height);
      const data = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
      return sum > 0;
    });
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

(async () => {
  const baseUrl = process.env.VISUAL_CHECK_URL || "http://127.0.0.1:5173/";
  const outA = process.env.VISUAL_CHECK_OUT_A || "test-screenshots/sprites_billboard_a.png";
  const outB = process.env.VISUAL_CHECK_OUT_B || "test-screenshots/sprites_billboard_b.png";

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

  await page.waitForSelector(".preset-card", { timeout: 120000 });
  await page.$eval(".preset-card", (el) => el.click && el.click());

  await clickByText(page, "button", "Cinematic 3D");
  await selectByLabel(page, "3D assets", "sprites");

  await clickByText(page, "button", "Apply");
  await new Promise((r) => setTimeout(r, 3000));
  await clickByText(page, "button", "Run");

  await waitForCanvasDraw(page, 120000);
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: outA, fullPage: false });
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: outB, fullPage: false });

  await browser.close();
})();
