const { chromium } = require("playwright");

/**
 * automation.js
 * 
 * Usage: node automate.js <wsEndpoint>
 * Example: node automate.js ws://127.0.0.1:54321/abcdef123456
 */

async function run() {
  const wsEndpoint = process.argv[2];

  if (!wsEndpoint) {
    console.error("Error: Please provide a wsEndpoint as a command line argument.");
    console.log("Usage: node automate.js <wsEndpoint>");
    process.exit(1);
  }

  console.log(`Connecting to browser at ${wsEndpoint}...`);

  try {
    // Connect to the existing browser instance
    const browser = await chromium.connect({ wsEndpoint });
    
    // Get the first context (or create a new one if needed, but usually we attach to the existing one)
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    
    const page = await context.newPage();
    
    console.log("Navigating to google.com...");
    await page.goto("https://www.google.com");
    
    console.log("Waiting 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("Taking screenshot...");
    await page.screenshot({ path: "screenshot.png" });
    
    console.log("done");
    
    // We don't close the browser here because it's managed by the Profile Manager server
    // But we should close the connection
    await browser.close();
  } catch (error) {
    console.error("Automation failed:", error);
    process.exit(1);
  }
}

run();
