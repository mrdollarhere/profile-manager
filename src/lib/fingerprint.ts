/**
 * A utility to generate consistent, realistic browser fingerprints based on a seed.
 */

export interface Fingerprint {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  languages: string[];
  webglVendor: string;
  webglRenderer: string;
  canvasSeed: number;
}

const platforms = [
  { name: "Win32", os: "Windows NT 10.0; Win64; x64" },
  { name: "MacIntel", os: "Macintosh; Intel Mac OS X 10_15_7" },
  { name: "Linux x86_64", os: "X11; Linux x86_64" },
];

const timezones = ["America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney", "Europe/Paris", "America/Los_Angeles"];
const languages = [["en-US", "en"], ["en-GB", "en"], ["fr-FR", "fr"], ["de-DE", "de"], ["ja-JP", "ja"]];
const resolutions = [[1920, 1080], [1440, 900], [1366, 768], [2560, 1440], [1536, 864]];
const webglVendors = ["Google Inc. (Intel)", "Google Inc. (NVIDIA)", "Google Inc. (AMD)"];
const webglRenderers = [
  "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0)",
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateFingerprint(seed: number): Fingerprint {
  const rand = (max: number) => Math.floor(seededRandom(seed) * max);
  const randItem = <T>(arr: T[]): T => arr[Math.floor(seededRandom(seed) * arr.length)];

  const platformInfo = randItem(platforms);
  const resolution = randItem(resolutions);
  const chromeVersion = `122.0.${rand(6000)}.${rand(200)}`;

  return {
    userAgent: `Mozilla/5.0 (${platformInfo.os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
    platform: platformInfo.name,
    screenWidth: resolution[0],
    screenHeight: resolution[1],
    timezone: randItem(timezones),
    languages: randItem(languages),
    webglVendor: randItem(webglVendors),
    webglRenderer: randItem(webglRenderers),
    canvasSeed: Math.floor(seededRandom(seed + 1) * 1000000),
  };
}
