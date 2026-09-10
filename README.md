# Spin Wheel Sastro Draw

Aplikasi web single-page untuk undian (lucky draw) berbasis data Excel. Dibangun dengan **React + Vite + TypeScript**, Tailwind CSS v4, Zustand, SheetJS, Motion, dan canvas-confetti. Semua pemrosesan terjadi di browser, tanpa backend, dan tetap berjalan offline setelah dibuka.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
npm run preview  # preview hasil build
```

Hasil `npm run build` di folder `dist/` adalah file statis yang bisa dibuka lewat web server apa pun (mis. `npx serve dist`).

## Alur pemakaian saat event

1. **Import Excel** (tombol di header atau tekan `I`). Drag & drop file `.xlsx`/`.xls`, lihat ringkasan validasi (valid, duplikat, ID/nama kosong), pilih kebijakan duplikat, lalu import.
2. **Review peserta** (tekan `P`): cari, filter Departemen / Pin Point / Contract Type / Status, sort, dan keluarkan peserta dari pool bila perlu.
3. **Atur hadiah & konfigurasi** (tekan `S`): daftar prize berurutan beserta kuota, jumlah pemenang per spin, durasi spin, suara, confetti, tema.
4. **Fullscreen** (tekan `F`) saat sudah terhubung ke projector/TV.
5. **Spin** (klik tombol, klik hub roda, atau tekan `Space`). Pemenang ditentukan lebih dulu dengan Web Crypto API, lalu roda diarahkan ke target secara deterministik.
6. **Winner reveal** dengan confetti dan fanfare. Lanjut dengan `Space`/`Enter`, atau **Undo Winner** jika ada kesalahan.
7. **History** (tekan `H`): daftar seluruh pemenang, undo per pemenang, export ke Excel.

**Roda, reel, dan pemenang.** Jumlah nama yang ikut diundi tidak dibatasi. Sampai 16 nama ditampilkan sebagai roda; lebih dari itu tampilan otomatis berganti ke *reel* (gulungan nama vertikal ala mesin slot) yang tetap ringan untuk ratusan nama. Mode tampilan bisa dikunci di Settings (Otomatis / Selalu roda / Selalu reel). Pemenang selalu diambil dari nama yang sedang ada di roda atau reel, dan daftar nama tidak berubah saat Spin ditekan. Setelah menang, nama tersebut keluar dari daftar. Tombol **Acak Peserta** mengisi roda dengan 16 peserta acak dari pool (mengikuti filter departemen / pin point yang tersimpan). Tombol **Pilih Peserta** (tekan `W`) membuka modal untuk memilih nama secara manual: filter departemen dan pin point, cari nama, centang satu per satu, "Acak 16 dari hasil filter", atau "Pilih semua berurutan" yang mengganti isi roda dengan seluruh hasil filter sesuai urutan daftar.

**Lebih dari satu pemenang per spin.** Jika pengaturan "Jumlah pemenang per spin" lebih dari 1, roda berputar berurutan untuk setiap pemenang: putaran pertama penuh, putaran berikutnya lebih singkat. Setiap segmen pemenang diberi badge nomor dan ada indikator "Pemenang 2 dari 3" di roda, lalu semua pemenang ditampilkan bersama di winner reveal.

Session (peserta, pemenang, prize, pengaturan, isi roda) tersimpan otomatis di `localStorage`, sehingga refresh browser tidak menghilangkan hasil undian.

## Format Excel

Kolom wajib: **Nomor Induk Karyawan**, **Nama**. Kolom opsional: Pin Point, Departemen, Posisi terakhir, Contract Type.

Nama header fleksibel (mis. `NIK`, `Employee ID`, `Name`, `Department` juga dikenali). Baris header boleh tidak berada di baris pertama; aplikasi mencari header di 10 baris awal. Tombol **Template** di modal import mengunduh contoh file dengan header yang benar. File contoh berisi 997 peserta beserta beberapa baris bermasalah tersedia di `samples/peserta-contoh.xlsx`.

## Keyboard shortcut

| Tombol            | Fungsi                               |
| ----------------- | ------------------------------------ |
| `Space` / `Enter` | Spin, atau lanjut dari winner reveal |
| `Esc`             | Tutup modal / overlay                |
| `F`               | Fullscreen / presentation mode       |
| `P`               | Daftar peserta                       |
| `H`               | Winner history                       |
| `S`               | Settings & prize                     |
| `I`               | Import Excel                         |
| `W`               | Pilih peserta di roda                |

## Struktur proyek

```
src/
├── components/
│   ├── ui/                 Button, Modal, Toggle, Field, Badge, ConfirmDialog
│   ├── layout/             Header, RecentWinners
│   ├── spin-wheel/         SpinWheel (SVG + rAF), MainStage
│   ├── import-excel/       ImportModal
│   ├── participant-modal/  ParticipantModal
│   ├── winner-modal/       WinnerOverlay
│   ├── history-modal/      HistoryModal
│   ├── settings-modal/     SettingsModal
│   └── wheel-modal/        WheelModal (pilih peserta di roda)
├── hooks/                  useFullscreen, useKeyboardShortcuts
├── lib/                    excel.ts, random.ts, sound.ts, storage.ts, utils.ts
├── stores/draw.store.ts    Zustand store + selectors (persisted)
└── types/participant.ts
```

## Catatan desain

- Roda menggambar satu segmen per peserta di roda (label disembunyikan di atas 24 segmen, nama di bawah jarum ditampilkan sebagai chip). Reel hanya merender beberapa baris di sekitar posisi saat ini, sehingga jumlah peserta tidak memengaruhi performa. Pemenang dipilih dari daftar itu, lalu roda/reel diarahkan ke pemenang secara deterministik tanpa mengubah urutan nama.
- Pemenang dipilih dengan `crypto.getRandomValues` dan rejection sampling (tanpa modulo bias).
- Efek suara disintesis dengan Web Audio API sehingga tidak ada aset eksternal dan tetap berjalan offline.
- Spin dikunci selama animasi: tombol, hub roda, dan shortcut tidak dapat memicu spin kedua.
- Prize berikutnya otomatis aktif ketika kuota prize saat ini habis; bila semua prize selesai, tampil state "session completed".
