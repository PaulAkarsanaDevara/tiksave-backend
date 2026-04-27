# TikSave — TikTok Downloader

Download video TikTok tanpa watermark dalam kualitas HD, SD, atau MP3. Terdiri dari dua bagian: **frontend** (React + TypeScript + Redux) dan **backend** (Express + yt-dlp).

---

## Prasyarat

- **Node.js** v18+
- **yt-dlp** — wajib diinstall di sistem

### Install yt-dlp

**macOS / Linux:**
```bash
pip install yt-dlp
# atau
brew install yt-dlp
```

**Windows:**
```bash
winget install yt-dlp
# atau download dari https://github.com/yt-dlp/yt-dlp/releases
```

---

## Struktur Proyek

```
tiksave-backend/    ← Backend Express (port 3001)
tiktok-downloader/  ← Frontend React + Redux (port 5173)
```

---

## Setup & Jalankan

### 1. Backend

```bash
cd tiksave-backend
npm install
npm start
```

Server berjalan di `http://localhost:3001`

**Endpoints:**
- `GET /api/info?url=<tiktok_url>` — ambil info video
- `GET /api/download?url=<tiktok_url>&quality=hd|sd|audio` — download file
- `GET /api/health` — cek status server

---

### 2. Frontend

```bash
cd tiktok-downloader
npm install

# (opsional) buat .env jika backend bukan di localhost:3001
cp .env.example .env
# edit VITE_API_URL jika perlu

npm run dev
```

Buka `http://localhost:5173`

---

## Cara Pakai

1. Salin link video TikTok (contoh: `https://www.tiktok.com/@user/video/123456`)
2. Paste di kolom input dan klik **Ambil Video**
3. Pilih kualitas: **HD**, **SD**, atau **Audio (MP3)**
4. Klik **Download** — file akan otomatis tersimpan

---

## Tech Stack

| Layer     | Teknologi                              |
|-----------|----------------------------------------|
| Frontend  | React 18, TypeScript, Redux Toolkit, Vite |
| Backend   | Express.js, yt-dlp, CORS              |
| Downloader | yt-dlp (mendukung TikTok, watermark-free) |

---

## Catatan

- Video TikTok **private** tidak bisa didownload
- Gunakan hanya untuk keperluan pribadi, hormati hak cipta kreator
- yt-dlp perlu diupdate secara berkala: `pip install -U yt-dlp`
