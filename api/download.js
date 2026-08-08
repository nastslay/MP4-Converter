// api/download.js
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

const isWindows = os.platform() === 'win32';
const YT_DLP_FILENAME = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YT_DLP_PATH = path.join(os.tmpdir(), YT_DLP_FILENAME);
const YT_DLP_DOWNLOAD_URL = isWindows
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function isYtDlpFresh() {
  if (!fs.existsSync(YT_DLP_PATH)) return false;
  const stats = fs.statSync(YT_DLP_PATH);
  const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
  return ageHours < 24;
}

async function ensureYtDlp() {
  if (isYtDlpFresh()) return;

  console.log(`Pobieranie/aktualizacja ${YT_DLP_FILENAME}...`);
  const response = await fetch(YT_DLP_DOWNLOAD_URL);
  if (!response.ok) throw new Error(`Błąd pobierania yt-dlp: ${response.status}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(YT_DLP_PATH, Buffer.from(buffer));
  if (!isWindows) fs.chmodSync(YT_DLP_PATH, 0o755);
  console.log('yt-dlp gotowy.');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, raw } = req.query;
  if (!url) return res.status(400).json({ error: 'Brak parametru url' });

  try {
    let videoUrl = url;
    const isDirectMp4 = url.includes('video.twimg.com') || url.endsWith('.mp4');

    if (!isDirectMp4) {
      await ensureYtDlp();

      const args = [
        '-g',                             // tylko URL
        '--no-check-certificate',
        '--no-warnings',
        '--user-agent', USER_AGENT,
        '--extractor-retries', '5',
        '--retries', '5',
        '--geo-bypass',                   // obejście geoblokad
        '--no-playlist',
        '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        url,
      ];

      // Rozszerzone nagłówki dla TikToka
      if (url.includes('tiktok.com')) {
        args.push(
          '--add-header', 'Referer:https://www.tiktok.com/',
          '--add-header', 'Origin:https://www.tiktok.com',
          '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          '--add-header', 'Accept-Language:pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
          '--add-header', 'Sec-Fetch-Dest:document',
          '--add-header', 'Sec-Fetch-Mode:navigate',
          '--add-header', 'Sec-Fetch-Site:none',
          '--add-header', 'Sec-Fetch-User:?1',
          '--add-header', 'Upgrade-Insecure-Requests:1'
        );
      }

      console.log('Wykonuję yt-dlp z args:', args);

      let stdout = '', stderr = '';
      try {
        // Używamy execFile zamiast exec — bez shella, bezpieczniejsze i niezawodniejsze
        const result = await execFileAsync(YT_DLP_PATH, args, {
          timeout: 60000,           // 60 s (zobacz uwagę o maxDuration poniżej)
          killSignal: 'SIGKILL',
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (execErr) {
        console.error('yt-dlp błąd:', execErr.stderr || execErr.message);
        throw new Error(
          `yt-dlp nie znalazł linku: ${(execErr.stderr || execErr.message || '').trim().slice(0, 500)}`
        );
      }

      if (stderr) console.warn('yt-dlp stderr:', stderr);

      const lines = stdout.split('\n').map(l => l.trim());
      videoUrl = lines.find(l => l.startsWith('http'));
      if (!videoUrl) {
        throw new Error(`yt-dlp nie zwrócił poprawnego URL. Stdout: ${stdout.slice(0, 300)}`);
      }
    }

    // Zwracanie surowego pliku wideo
    if (raw === 'true') {
      const headers = { 'User-Agent': USER_AGENT };

      if (videoUrl.includes('twimg.com') || videoUrl.includes('twitter.com')) {
        headers['Referer'] = 'https://x.com/';
      } else if (
        videoUrl.includes('tiktok') ||
        videoUrl.includes('tiktokcdn') ||
        videoUrl.includes('tiktokv')
      ) {
        headers['Referer'] = 'https://www.tiktok.com/';
        headers['Origin'] = 'https://www.tiktok.com';
      }

      const videoResponse = await fetch(videoUrl, { headers });
      if (!videoResponse.ok) {
        throw new Error(`Pobranie wideo nie powiodło się: ${videoResponse.status}`);
      }

      const buffer = await videoResponse.arrayBuffer();
      res.setHeader('Content-Type', 'video/mp4');
      return res.send(Buffer.from(buffer));
    }

    res.status(200).json({ videoUrl });
  } catch (error) {
    console.error('Całkowity błąd:', error);
    res.status(500).json({
      error: 'Nie udało się pobrać wideo. Sprawdź, czy link jest publiczny i poprawny.',
      details: error.message,
    });
  }
}
