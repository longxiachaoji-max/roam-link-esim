const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://roam-link-esim.vercel.app/admin/esim-inventory', { waitUntil: 'networkidle0' });
  const html = await page.content();
  if (html.includes('1A1A2E') || html.includes('backdrop-blur')) {
    console.log('Found new code!');
  } else {
    console.log('Old code...');
  }
  await browser.close();
})();
