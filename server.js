const express = require('express');
const cors = require('cors');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3001;

const YT_DLP =
  process.env.YT_DLP_PATH ||
  (process.platform === 'win32'
    ? path.join(__dirname, 'yt-dlp.exe')
    : 'yt-dlp');

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── helpers ──────────────────────────────────────────────

function resolveUrl(raw) {
  // raw bisa sudah ter-encode atau belum
  try {
    const decoded = decodeURIComponent(raw);
    // pastikan bisa di-parse sebagai URL
    new URL(decoded);
    return decoded;
  } catch {
    try {
      new URL(raw);
      return raw;
    } catch {
      return null;
    }
  }
}

function isValidTikTokUrl(url) {
  return /tiktok\.com/.test(url);
}

async function getVideoInfo(url) {
  const { stdout } = await execFileAsync(
    YT_DLP,
    ['--dump-json', '--no-playlist', '--no-warnings', url],
    { timeout: 30_000 },
  );

  const info = JSON.parse(stdout);

  const formats = (info.formats || []).filter((f) => f.url);
  const hd = formats
    .filter((f) => f.vcodec !== 'none' && f.height >= 720)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const sd = formats
    .filter((f) => f.vcodec !== 'none' && f.height < 720)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const any = formats
    .filter((f) => f.vcodec !== 'none')
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const aud = formats.filter(
    (f) => f.vcodec === 'none' && f.acodec !== 'none',
  )[0];

  const dur = info.duration || 0;
  const durStr = `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}`;

  return {
    id: info.id || String(Date.now()),
    url,
    title: info.title || info.description || 'TikTok Video',
    author: info.uploader ? `@${info.uploader}` : '@unknown',
    authorAvatar: info.thumbnail || '',
    thumbnail: info.thumbnail || '',
    duration: durStr,
    views: info.view_count ? formatCount(info.view_count) : '—',
    likes: info.like_count ? formatCount(info.like_count) : '—',
    music: info.track
      ? `🎵 "${info.track}"${info.artist ? ' - ' + info.artist : ''}`
      : '🎵 original sound',
    downloadUrls: {
      hd: (hd || any)?.url || null,
      sd: (sd || any)?.url || null,
      audio: aud?.url || null,
    },
  };
}

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ── routes ───────────────────────────────────────────────

app.get('/api/info', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).json({ error: 'Parameter url diperlukan' });

  const url = resolveUrl(raw);
  console.log('[info] raw:', raw);
  console.log('[info] resolved:', url);

  if (!url || !isValidTikTokUrl(url)) {
    return res.status(400).json({
      error:
        'URL bukan link TikTok yang valid. Pastikan link mengandung tiktok.com',
    });
  }

  try {
    const info = await getVideoInfo(url);
    res.json({ success: true, data: info });
  } catch (err) {
    console.error('[info] error:', err.message);
    const msg = err.message?.includes('Unsupported URL')
      ? 'URL tidak didukung.'
      : err.message?.includes('Private')
        ? 'Video ini private atau sudah dihapus.'
        : err.message?.includes('ENOENT')
          ? `yt-dlp tidak ditemukan. Path: ${YT_DLP}`
          : 'Gagal mengambil info video: ' + err.message;
    res.status(500).json({ error: msg });
  }
});

app.get('/api/download', async (req, res) => {
  const raw = req.query.url;
  const quality = req.query.quality || 'hd';

  if (!raw) return res.status(400).json({ error: 'Parameter url diperlukan' });

  const url = resolveUrl(raw);
  console.log('[download] raw:', raw);
  console.log('[download] resolved:', url, 'quality:', quality);

  if (!url || !isValidTikTokUrl(url)) {
    return res.status(400).json({ error: 'URL tidak valid' });
  }

  let formatArg;
  if (quality === 'audio') {
    formatArg = 'bestaudio';
  } else if (quality === 'sd') {
    formatArg = 'bestvideo[height<=480]+bestaudio/best[height<=480]/best';
  } else {
    formatArg = 'bestvideo+bestaudio/best';
  }

  const ext = quality === 'audio' ? 'mp3' : 'mp4';
  const filename = `tiktok_${quality}_${Date.now()}.${ext}`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader(
    'Content-Type',
    quality === 'audio' ? 'audio/mpeg' : 'video/mp4',
  );
  res.setHeader('Transfer-Encoding', 'chunked');

  const extraArgs =
    quality === 'audio'
      ? ['-x', '--audio-format', 'mp3', '--audio-quality', '0']
      : ['--merge-output-format', 'mp4'];

  const args = [
    '-f',
    formatArg,
    '--no-playlist',
    '--no-warnings',
    '-o',
    '-',
    ...extraArgs,
    url,
  ];

  const proc = spawn(YT_DLP, args);
  proc.stdout.pipe(res);
  proc.stderr.on('data', (d) => process.stderr.write(d));
  proc.on('error', (err) => {
    console.error('[download] spawn error:', err.message);
    if (!res.headersSent)
      res.status(500).json({ error: `yt-dlp error: ${err.message}` });
    else res.end();
  });
  proc.on('close', (code) => {
    if (code !== 0) console.error(`[download] yt-dlp exit code: ${code}`);
    res.end();
  });
  req.on('close', () => proc.kill());
});

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', ytdlp: YT_DLP, platform: process.platform }),
);

app.listen(PORT, () => {
  console.log(`\n🚀 TikSave Backend → http://localhost:${PORT}`);
  console.log(`   yt-dlp path: ${YT_DLP}\n`);
});
