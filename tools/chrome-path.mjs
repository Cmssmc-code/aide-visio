import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function findChrome() {
  const env = process.env.AIDE_VISIO_CHROME;
  if (env && fs.existsSync(env)) return env;

  const candidates = [];
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const pwRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(local, 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
  ].filter(Boolean);
  for (const root of pwRoots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)); } catch { continue; }
    dirs.sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      candidates.push(
        path.join(root, d, 'chrome-win64', 'chrome.exe'),
        path.join(root, d, 'chrome-win', 'chrome.exe'),
        path.join(root, d, 'chrome-linux64', 'chrome'),
        path.join(root, d, 'chrome-linux', 'chrome'),
        path.join(root, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      );
    }
  }
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  candidates.push(
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  );
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('Chromium introuvable : installez Chrome ou définissez AIDE_VISIO_CHROME=<chemin de chrome.exe>.');
}
