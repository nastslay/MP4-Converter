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
      
      // ZMIANA: Bardziej elastyczny wybór formatu
      // Próbuje znaleźć najlepsze mp4, a jeśli nie ma, bierze cokolwiek najlepszego
      const formatSelection = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
      
      // Dodajemy flagi --no-check-certificate i --user-agent dla lepszej stabilności
      const command = `${YT_DLP_PATH} -g --no-check-certificate -f "${formatSelection}" "${url}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stdout) {
        console.error('yt-dlp stderr:', stderr);
        throw new Error('yt-dlp nie znalazło linku');
      }

      videoUrl = stdout.trim().split('\n')[0];
    }

    if (raw === 'true') {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      };
      
      if (videoUrl.includes('twimg.com') || videoUrl.includes('twitter.com')) {
        headers['Referer'] = 'https://x.com/';
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