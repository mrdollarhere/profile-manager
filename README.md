# Browser Profile Manager

A comprehensive browser profile manager with proxy support, fingerprinting, and automation capabilities.

## Features
- **Profile Isolation:** Each profile has its own cookies, storage, and fingerprint.
- **Proxy Support:** Configure HTTP/SOCKS proxies per profile.
- **Fingerprinting:** Customize User-Agent, screen resolution, timezone, and languages.
- **Automation Scripts:** Run custom Playwright scripts on any profile.
- **Real-time Monitoring:** View active sessions and live console logs.
- **API Access:** Control your profiles via a secure REST API.

## Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd browser-manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

4. **Set up environment variables:**
   Copy `.env.example` to `.env` and configure as needed.
   ```bash
   cp .env.example .env
   ```

## Development

Run the application in development mode with hot-reloading for the frontend:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## Production

### 1. Build the frontend
```bash
npm run build
```

### 2. Start the server
You can start the server directly:
```bash
npm start
```

### 3. Run as a background service with PM2
If you have PM2 installed globally (`npm install -g pm2`), you can use the provided ecosystem file:
```bash
pm2 start ecosystem.config.js
```

## Automation API

The application provides a REST API to launch profiles and run scripts. These routes are protected by an API key that you can generate in the **Settings** page.

### Launch a Profile
```bash
curl -X POST http://localhost:3000/api/profiles/1/launch \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Run a Script
```bash
curl -X POST http://localhost:3000/api/scripts/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": 1,
    "scriptName": "screenshot.js"
  }'
```

## Writing Custom Scripts

Automation scripts are stored in the `scripts/` folder. Each script must export an `async function run(page)`.

### Example: `my-script.js`
```javascript
export async function run(page) {
  console.log("Navigating to example.com...");
  await page.goto("https://example.com");
  
  const title = await page.title();
  console.log(`Page title: ${title}`);
  
  // You can use any Playwright Page methods here
  await page.screenshot({ path: "example.png" });
  console.log("Screenshot saved!");
}
```

## Maintenance
- **Clear Sessions:** Stop all active browsers via the Settings page.
- **Vacuum Database:** Optimize the SQLite database via the Settings page.
- **Backup/Restore:** Export and import your profiles as JSON files in the Settings page.
