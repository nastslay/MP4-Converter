// api/download.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

const isWindows = os.platform() === 'win32';
const YT_DLP_FILENAME = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YT_DLP_PATH = path.join(os.tmpdir(), YT_DLP_FILENAME);
const YT_DLP_DOWNLOAD_URL = isWindows
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

// Wspólny User-Agent (przeglądarka desktop + mobile fallback)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function ensureYtDlp() {
  if (fs.existsSync(YT_DLP_PATH)) return;

  console.log(`Pobieranie najnowszej wersji ${YT_DLP_FILENAME}...`);
  const response = await fetch(YT_DLP_DOWNLOAD_URL);
  if (!response.ok) throw new Error(`Błąd pobierania yt-dlp: ${response.status}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(YT_DLP_PATH, Buffer.from(buffer));
  if (!isWindows) fs.chmodSync(YT_DLP_PATH, 0o755);
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

      // Przygotowujemy rozszerzoną listę argumentów, by zwiększyć skuteczność na TikToku
      // i innych platformach wymagających Referer / dodatkowych nagłówków.
      const args = [
        '-g',                          // wypisz tylko bezpośredni URL
        '--no-check-certificate',
        '--no-warnings',
        '--user-agent', USER_AGENT,
        '--add-header', `Referer:https://www.tiktok.com/`,  // kluczowe dla TikTok CDN
        '--extractor-retries', '5',
        '--retries', '5',
        '--no-playlist',
        '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        url,
      ];

      // Tik Tok często potrzebuje także dodatkowego nagłówka Origin (w niektórych wersjach CDN)
      // oraz mobilnego User-Agent w samym yt-dlp – dla bezpieczeństwa wrzucamy osobny wariant.
      if (url.includes('tiktok.com')) {
        args.push('--add-header', 'Origin:https://www.tiktok.com');
        // Opcjonalnie: wymuszenie konkretnej wersji API (obejście blokad regionalnych)
        // args.push('--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com');
      }

      const command = `${YT_DLP_PATH} ${args.map(a => `"${a}"`).join(' ')}`;

      let stdout = '', stderr = '';
      try {
        ({ stdout, stderr } = await execAsync(command, { timeout: 30000 })); // 30s timeout
      } catch (execErr) {
        console.error('yt-dlp exec błąd, stderr:', execErr.stderr || execErr.message);
        throw new Error(
          `yt-dlp nie znalazło linku: ${(execErr.stderr || execErr.message || '').trim().slice(0, 300)}`
        );
      }

      if (stderr && !stdout) {
        console.error('yt-dlp stderr:', stderr);
        throw new Error('yt-dlp nie znalazło linku (pusty stdout)');
      }

      // Czasem yt-dlp zwraca kilka linii – bierzemy pierwszą niepustą
      videoUrl = stdout
        .trim()
        .split('\n')
        .map(l => l.trim())
        .find(l => l.startsWith('http'));
      if (!videoUrl) throw new Error('Nie udało się wyodrębnić adresu wideo');
    }

    // Zwracanie surowego pliku wideo (raw=true)
    if (raw === 'true') {
      const headers = {
        'User-Agent': USER_AGENT,
      };

      // Referer dostosowany do platformy (CDN często tego wymaga)
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
        throw new Error(`Błąd pobierania wideo: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      const buffer = await videoResponse.arrayBuffer();
      res.setHeader('Content-Type', 'video/mp4');
      return res.send(Buffer.from(buffer));
    }

    // Zwracanie samego linku (raw=false / domyślnie)
    res.status(200).json({ videoUrl });
  } catch (error) {
    console.error('Błąd szczegółowy:', error);
    res.status(500).json({
      error: 'Nie udało się pobrać wideo. Upewnij się, że wpis ma publiczne wideo.',
      details: error.message,
    });
  }
}
