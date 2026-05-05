import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the dashboard (assuming already logged in by user)
  await page.goto('https://app.supabase.com/projects');
  
  // Find your eSIM project (replace with actual project slug if known, or find by text)
  // For demonstration, let's try to find by text content "eSIM"
  const projectLink = await page.locator('text=eSIM').first(); // Adjust selector if needed
  if (projectLink) {
    await projectLink.click();
    await page.waitForURL('**/project/**'); // Wait for project page to load
    
    // Navigate to API settings
    await page.goto(page.url() + '/settings/api');
    await page.waitForSelector('text=Project API keys'); // Wait for API keys section
    
    console.log();
  } else {
    console.log("Could not find eSIM project. Please navigate manually and share the URL.");
  }

  await browser.close();
})();
