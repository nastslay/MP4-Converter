// api/download.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const isWindows = os.platform() === 'win32';
const YT_DLP_FILENAME = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YT_DLP_PATH = path.join(os.tmpdir(), YT_DLP_FILENAME);
const YT_DLP_DOWNLOAD_URL = isWindows
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

async function ensureYtDlp() {
  // Opcjonalnie: Możesz dodać sprawdzenie daty pliku, aby pobierać nowy raz na 24h
  if (fs.existsSync(YT_DLP_PATH)) return;
  
  console.log(`Pobieranie najnowszej wersji ${YT_DLP_FILENAME}...`);
  const response = await fetch(YT_DLP_DOWNLOAD_URL);
  if (!response.ok) throw new Error(`Błąd pobierania yt-dlp: ${response.status}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(YT_DLP_PATH, Buffer.from(buffer));
  if (!isWindows) fs.chmodSync(YT_DLP_PATH, 0o755);
}

// Krótkie linki (vm.tiktok.com/xxx, vt.tiktok.com/xxx) to przekierowania do pełnego
// adresu w stylu https://www.tiktok.com/@user/video/123... . Realna przeglądarka,
// po przejściu przekierowania, wysyła jako Referer właśnie ten PEŁNY adres — nie
// oryginalny krótki link. Rozwiązujemy więc przekierowanie zawczasu, żeby Referer
// (i pozostała logika) odzwierciedlały to, co zrobiłaby prawdziwa przeglądarka.
async function resolveTikTokShortUrl(inputUrl) {
  const isShortLink = /(?:^|\.)v[mt]\.tiktok\.com/.test(inputUrl);
  if (!isShortLink) return inputUrl;
  try {
    const res = await fetch(inputUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA },
    });
    return res.url || inputUrl;
  } catch (e) {
    console.error('Nie udało się rozwiązać krótkiego linku TikTok:', e.message);
    return inputUrl; // w razie problemu próbujemy dalej z oryginalnym linkiem
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, raw } = req.query;
  if (!url) return res.status(400).json({ error: 'Brak parametru url' });

  try {
    // Jeśli to krótki link TikToka (vm./vt.tiktok.com), rozwiązujemy go na pełny adres
    // zanim cokolwiek innego zrobimy — reszta kodu operuje już na pełnym linku.
    const resolvedUrl = await resolveTikTokShortUrl(url);

    let videoUrl = resolvedUrl;
    const isDirectMp4 = resolvedUrl.includes('video.twimg.com') || resolvedUrl.endsWith('.mp4');

    if (!isDirectMp4) {
      await ensureYtDlp();
      
      // ZMIANA: Bardziej elastyczny wybór formatu
      // Próbuje znaleźć najlepsze mp4, a jeśli nie ma, bierze cokolwiek najlepszego
      const formatSelection = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";

      // Dodajemy flagi --no-check-certificate i --user-agent dla lepszej stabilności
      // --user-agent jest szczególnie istotny dla TikToka, który częściej blokuje
      // domyślny user-agent yt-dlp niż np. Twitter/X.
      const command = `${YT_DLP_PATH} -g --no-check-certificate --user-agent "${BROWSER_UA}" -f "${formatSelection}" "${resolvedUrl}"`;

      let stdout = '', stderr = '';
      try {
        ({ stdout, stderr } = await execAsync(command));
      } catch (execErr) {
        // Gdy yt-dlp zwraca kod błędu, promisify(exec) odrzuca obietnicę i realny,
        // szczegółowy komunikat trafia do execErr.stderr — a nie do execErr.message.
        // Bez tego traciliśmy prawdziwy powód niepowodzenia (np. konkretny błąd ekstraktora TikToka).
        console.error('yt-dlp exec błąd, stderr:', execErr.stderr || execErr.message);
        throw new Error(`yt-dlp nie znalazło linku: ${(execErr.stderr || execErr.message || '').trim().slice(0, 300)}`);
      }
      if (stderr && !stdout) {
        console.error('yt-dlp stderr:', stderr);
        throw new Error('yt-dlp nie znalazło linku');
      }

      videoUrl = stdout.trim().split('\n')[0];
    }

    if (raw === 'true') {
      const headers = {
        'User-Agent': BROWSER_UA
      };
      
      if (resolvedUrl.includes('x.com') || resolvedUrl.includes('twitter.com') || resolvedUrl.includes('video.twimg.com')) {
        headers['Referer'] = 'https://x.com/';
      } else if (resolvedUrl.includes('tiktok.com')) {
        // CDN TikToka jest wybredny co do anty-hotlinkingu: sam ogólny "tiktok.com" jako
        // Referer bywa za mało precyzyjny i dostajemy 403. Używamy więc DOKŁADNEGO adresu
        // strony z filmem (już rozwiązanego z ew. krótkiego linku) — to jest to, co realna
        // przeglądarka wysłałaby jako Referer, oglądając ten konkretny film.
        // Dokładamy też Origin, bo część CDN-ów sprawdza oba nagłówki naraz.
        headers['Referer'] = resolvedUrl;
        headers['Origin'] = 'https://www.tiktok.com';
      }
      
      const videoResponse = await fetch(videoUrl, { headers });
      if (!videoResponse.ok) throw new Error(`Błąd fetch wideo: ${videoResponse.status}`);

      const buffer = await videoResponse.arrayBuffer();
      res.setHeader('Content-Type', 'video/mp4');
      return res.send(Buffer.from(buffer));
    }

    res.status(200).json({ videoUrl });
  } catch (error) {
    console.error('Błąd szczegółowy:', error);
    res.status(500).json({ 
      error: 'Nie udało się pobrać wideo. Upewnij się, że wpis ma publiczne wideo.',
      details: error.message 
    });
  }
}
