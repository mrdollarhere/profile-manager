/**
 * Google Search Script
 * Fills a Google search and waits for results.
 */
export async function run(page) {
  console.log("Starting Google Search script...");
  await page.goto("https://www.google.com");
  console.log("Navigated to Google.");
  
  // Accept cookies if present (optional, depends on location)
  try {
    const acceptBtn = await page.getByRole('button', { name: 'Accept all' });
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      console.log("Accepted cookies.");
    }
  } catch (e) {}

  const searchBox = await page.locator('textarea[name="q"]');
  await searchBox.fill("Playwright Browser Automation");
  console.log("Filled search box.");
  await searchBox.press("Enter");
  console.log("Pressed Enter.");
  
  await page.waitForSelector("#search");
  console.log("Search results loaded.");
  
  const title = await page.title();
  console.log(`Page title: ${title}`);
}
