/**
 * Screenshot Script
 * Takes a screenshot of the current page.
 */
export async function run(page) {
  console.log("Starting screenshot script...");
  await page.goto("https://www.google.com");
  console.log("Navigated to Google.");
  const screenshotPath = `screenshot-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);
}
