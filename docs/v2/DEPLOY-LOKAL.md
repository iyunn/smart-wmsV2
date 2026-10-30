# DEPLOY-LOKAL — Runbook Server SmartWMS V2

> Cara memasang, memperbarui, dan merawat SmartWMS V2 di PC server kantor (Windows 11).
> Dibuat: 30 Oktober 2026 (Tahap 6a, backup Tahap 6b). Keputusan teknis: `ARCHITECTURE.md` D-12, D-20, D-32–D-36.
> Panduan harian untuk admin server (bahasa non-teknis): [`MANUAL-ADMIN-SERVER.md`](MANUAL-ADMIN-SERVER.md).

---

## 1. Gambaran

```
PC lain di LAN ──http://<IP-server>:3000──▶ Windows Firewall (hanya TCP 3000, profil Domain/Private)
                                              │
                                              ▼
                           Service "SmartWMS" (WinSW, akun LocalService)
                           node --env-file=C:\SmartWMS\config\smartwms.env C:\SmartWMS\app\server.js
                                              │  localhost:5432
                                              ▼
                           PostgreSQL 18 (service postgresql-x64-18, listen_addresses = localhost)
                           database smartwms  ← role smartwms_prod_app / smartwms_prod_owner
                           database smartwms_dev (development, role terpisah)
```

| Folder | Isi | Hak akses |
|---|---|---|
| `C:\SmartWMS\src` | Clone GitHub khusus build produksi (bukan folder dev) | Administrator |
| `C:\SmartWMS\releases\<tanggal>-<commit>` | Hasil build per rilis (3 terakhir disimpan) | service: baca |
| `C:\SmartWMS\app` | Junction → rilis yang sedang jalan | service: baca |
| `C:\SmartWMS\config` | `smartwms.env` (service), `migrate.env`, `secrets.env` | `smartwms.env` service baca; lainnya Administrator saja |
| `C:\SmartWMS\logs` | Log aplikasi (`SmartWMS.out.log`, `SmartWMS.err.log`, `SmartWMS.wrapper.log`) | service: ubah |
| `C:\SmartWMS\bin` | `SmartWMS.exe` (WinSW v2.12.0) + `SmartWMS.xml` | Administrator |
| `C:\SmartWMS\backups` | Backup database + `last-backup.json` (folder bisa diganti, §8) | Administrator |

Semua script ada di `deploy\windows\` dan harus dijalankan dari **PowerShell sebagai Administrator**.

---

## 2. Membuka PowerShell Administrator

Cara paling mudah: klik kanan Start → **Terminal (Admin)** → pilih tab PowerShell, lalu:

```powershell
cd D:\BABAYAGA\HMM\project\smart-wmsV2
```

Dari bash MSYS2 juga bisa (membuka jendela baru, muncul konfirmasi UAC):

```bash
powershell.exe -NoProfile -Command 'Start-Process powershell -Verb RunAs -ArgumentList "-NoExit","-Command","cd D:\BABAYAGA\HMM\project\smart-wmsV2"'
```

Script tidak ditandatangani → selalu jalankan dengan `powershell -ExecutionPolicy Bypass -File ...`
(berlaku untuk perintah itu saja, setelan Windows tidak berubah).

---

## 3. Instalasi pertama

### 3.1 Prasyarat
- Windows 11, PostgreSQL 18 (installer EDB) dan Node.js 24 LTS (installer resmi, ke `C:\Program Files\nodejs`)
- **Git for Windows** bisa dipanggil dari PowerShell. Cek: `git --version`. Bila belum: `winget install Git.Git`
  (git bawaan MSYS2 tidak selalu terlihat dari PowerShell)
- Password superuser `postgres` (dibuat saat instal PostgreSQL)
- Internet (unduh WinSW & paket npm saat deploy)

### 3.2 Setup server (sekali)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\setup-server.ps1
```

Script meminta password `postgres`, lalu:
1. Cek Windows, Node.js ≥ 22.12, Git, PostgreSQL 18
2. Membuat folder `C:\SmartWMS\…` dengan hak akses terbatas
3. Membuat password acak role produksi → `C:\SmartWMS\config\secrets.env` (tidak pernah ditampilkan)
4. Database `smartwms` + role `smartwms_prod_owner` / `smartwms_prod_app` (D-32)
5. Setelan PostgreSQL (D-34) lalu **restart PostgreSQL** — server dev yang sedang jalan ikut putus beberapa detik
6. Memasang service `SmartWMS` (start otomatis, akun LocalService, restart otomatis bila crash)
7. Firewall: TCP 3000 masuk untuk profil Domain/Private
8. PC tidak sleep/hibernate saat tersambung listrik

Aman diulang. Password tidak berubah kecuali memakai `-NewCredentials`. Port lain: `-Port 3100`.

### 3.3 Deploy pertama

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\deploy.ps1
```

Mengambil branch `main` dari GitHub (yang sudah di-push), build, membuat tabel di database
`smartwms`, lalu menyalakan service. Pertama kali ±3–5 menit.

### 3.4 Isi data — impor V1 SATU KALI, lalu dikunci
Database produksi `smartwms` diisi data V1 **satu kali** (sudah dilakukan 30 Okt 2026). Sejak itu
`smartwms` adalah **sumber kebenaran**: input baru V2 hanya ada di sana.

> ⛔ **JANGAN pernah menjalankan `db:import-v1` / `scripts/import-v1.ts` ke database `smartwms`.**
> Impor mengosongkan (TRUNCATE) semua tabel lalu mengisinya dari Supabase → seluruh data yang
> dibuat di V2 hilang. Perintah yang dulu dipakai (dengan `migrate.env` produksi) sekarang ditolak:

Pengaman (ARCHITECTURE D-38), diuji di sandbox:
1. **Kunci** `app_settings.import_v1_locked` di `smartwms`, dipasang otomatis `deploy.ps1` (setiap deploy)
   dan `restore.ps1 -Production`. Skrip impor menolak database berkunci **apa pun flag-nya**.
   Cek: `status.ps1` → bagian *Pengaman data*.
2. Database tujuan yang **sudah berisi data** ditolak, kecuali `--replace-existing-data` (hanya untuk dev).
3. Skrip impor **versi lama** (clone yang belum di-`git pull`) gagal di cek skema karena tabel
   `app_settings` — sebelum ada yang dihapus.

Mengisi ulang **database dev** dari Supabase tetap boleh:
`npm run db:import-v1 -- --confirm smartwms_dev --replace-existing-data`

Melepas kunci produksi **tidak disediakan sebagai perintah**. Bila suatu hari benar-benar perlu
(mis. membangun ulang server dari nol dengan data Supabase), lakukan sebagai superuser setelah
backup + salinan ke disk lain, dan catat di journal:
`delete from app_settings where key = 'import_v1_locked';` — deploy berikutnya memasangnya lagi.

Server baru yang kosong (tanpa data V1): daftar akun di `/register`, lalu aktifkan lewat SQL
(database `smartwms`): `update app_users set status = 'active', role = 'super_admin' where username = '<nama>';`

### 3.5 Jaringan
- **IP tetap:** di router kantor buat *DHCP reservation* untuk MAC yang dicetak `setup-server.ps1`
  (atau `status.ps1`). Tanpa ini alamat `http://<IP>:3000` bisa berubah setelah restart router.
- **Pengguna mengakses lewat LAN kantor (Ethernet).** Firewall hanya membuka port 3000 untuk profil
  **Private/Domain**. Adapter Ethernet kantor harus Private (atau Domain bila PC join domain):
  `Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private`
  (nama adapter: `Get-NetAdapter`), atau Settings → Network & internet → Ethernet → Network profile
  type → **Private network**.
- **Wi-Fi/dongle untuk internet biarkan Public** — dengan begitu SmartWMS tidak terbuka di jaringan
  itu. Ethernet (Private) dan Wi-Fi (Public) boleh aktif bersamaan; Windows menerapkan profil per
  adapter. `deploy.ps1` butuh internet (GitHub & npm) dari salah satunya.
- DHCP reservation dibuat untuk **MAC adapter Ethernet**. Bila server terpaksa memakai Wi-Fi kantor:
  matikan *Random hardware addresses* untuk jaringan itu agar MAC tidak berubah.
- Uji dari PC lain: buka `http://<IP-server>:3000`.

### 3.6 Windows Update
Settings → Windows Update → Advanced options → **Active hours**: set jam kerja (mis. 06:00–20:00)
supaya restart otomatis tidak terjadi saat dipakai. Service SmartWMS & PostgreSQL menyala sendiri
setelah restart — tidak perlu login Windows.

---

## 4. Update versi (rilis baru)

1. Di folder dev: commit & push ke GitHub seperti biasa.
2. PowerShell Administrator:
   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\windows\deploy.ps1
   ```
3. Script mencetak `Sehat: rilis …` bila berhasil.

Yang terjadi: build di `C:\SmartWMS\src` → folder rilis baru → backup database → stop service →
migrasi database → `C:\SmartWMS\app` diarahkan ke rilis baru → start → cek `/api/health`.
Bila rilis baru tidak sehat dalam 90 detik, script **otomatis kembali ke rilis sebelumnya**.
Downtime normal: ±10–20 detik (antara stop dan health OK).

Rilis tag tertentu: `deploy.ps1 -Ref v2.0.0`.

---

## 5. Rollback

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1 -List      # daftar rilis
powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1            # ke rilis sebelumnya
powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1 -Release 20261030-140000-abc1234
```

Rollback hanya mengganti **kode**. Bila rilis yang dibatalkan membawa migrasi skema, kembalikan juga
database dari backup `predeploy-<commit>` yang dibuat otomatis sebelum migrasi (§8.4).

---

## 6. Cek kondisi & log

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\status.ps1
```

Menampilkan status service, rilis aktif, `/api/health`, URL LAN, sisa disk, dan 5 baris terakhir log
error. Log lengkap: `C:\SmartWMS\logs\` (berputar otomatis per 10 MB, 8 file).

Perintah service manual:

| Aksi | Perintah (PowerShell Admin) |
|---|---|
| Status | `Get-Service SmartWMS` |
| Restart | `Restart-Service SmartWMS` |
| Stop / start | `Stop-Service SmartWMS` / `Start-Service SmartWMS` |
| Hapus service | `C:\SmartWMS\bin\SmartWMS.exe uninstall` |

`GET http://localhost:3000/api/health` → `{"status":"ok","release":"…","db":"ok"}` (publik, tanpa
data sensitif).

---

## 7. Troubleshooting

| Gejala | Penyebab umum | Langkah |
|---|---|---|
| PC lain tidak bisa membuka `http://<IP>:3000` | Ethernet berprofil Public; memakai IP Wi-Fi bukan IP Ethernet; IP berubah; firewall pihak ketiga | Ethernet → Private (§3.5); pakai IP Ethernet; cek IP di `status.ps1`; buka port 3000 di antivirus bila ada |
| `localhost:3000` juga tidak bisa | Service mati / crash | `status.ps1`, baca `C:\SmartWMS\logs\SmartWMS.err.log` |
| Health `db: down` (HTTP 503) | PostgreSQL mati / password berubah | `Get-Service postgresql-x64-18`; bila password diubah manual: `setup-server.ps1 -NewCredentials` |
| `deploy.ps1`: `git` tidak ditemukan | Git hanya ada di MSYS2 | `winget install Git.Git`, buka ulang PowerShell |
| `deploy.ps1` gagal di `npm ci` | Internet / registry npm | Ulangi; rilis lama tetap jalan karena service belum dihentikan |
| `deploy.ps1` gagal di migrasi | Error SQL di migrasi baru | Service otomatis dinyalakan lagi dengan rilis lama; perbaiki migrasi, deploy ulang |
| `setup-server.ps1`: password postgres ditolak | Salah ketik | Jalankan ulang; reset lewat pgAdmin bila lupa |
| Port 3000 dipakai program lain | Bentrok | `setup-server.ps1 -Port 3100` lalu `deploy.ps1` |

**Jangan** menghapus `C:\SmartWMS\app` dengan Explorer/`Remove-Item -Recurse` — itu junction;
menghapusnya dengan cara itu bisa ikut menghapus isi rilis. Gunakan `rollback.ps1`/`deploy.ps1`.

---

## 8. Backup & restore (Tahap 6b, ARCHITECTURE D-35)

### 8.1 Pasang backup otomatis (sekali)
Syarat: perubahan Tahap 6b sudah di-push **dan** `deploy.ps1` sudah dijalankan (task memakai
`C:\SmartWMS\src\deploy\windows\backup.ps1` yang ikut ter-update setiap deploy).

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\setup-backup.ps1
```

- Backup harian **18:30** (ubah: `-At 12:15`), akun SYSTEM. Bila PC mati di jam itu, backup jalan
  begitu PC menyala lagi.
- Disimpan di `C:\SmartWMS\backups` **14 hari** (ubah: `-KeepDays 30`, folder lain: `-BackupDir D:\Backup`);
  3 backup terbaru tidak pernah dihapus walau sudah tua.
- Script langsung menjalankan backup pertama dan menampilkan hasilnya.

### 8.2 Salinan luar disk (wajib, PRD A9)
Backup di disk yang sama tidak menolong kalau disk rusak / PC hilang. Tentukan tujuan, lalu:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\setup-backup.ps1 -OffsiteDir E:\Backup-SmartWMS
```

| Tujuan | Catatan |
|---|---|
| **Hardisk/flashdisk eksternal** (disarankan) | Biarkan tercolok, atau colokkan minimal seminggu sekali — backup berikutnya otomatis menyalin. Huruf drive harus tetap (atur di Disk Management) |
| Folder bersama di PC/NAS lain (`\\PC-LAIN\Backup`) | Task berjalan sebagai SYSTEM → folder harus memberi akses ke akun komputer server (`NAMA-PC$`) |
| Folder sinkron cloud (Google Drive/OneDrive) | Hanya bila diizinkan kebijakan data perusahaan |

Salinan dibuat bila salinan terakhir di tujuan sudah ≥ 7 hari, disimpan 56 hari (minimal 2 file).
Bila tujuan tidak terhubung, dicatat di `backup.log` dan dicoba lagi besok. `status.ps1`
memperingatkan bila salinan luar disk > 8 hari.

### 8.3 Backup manual
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\backup.ps1 -Tag manual
powershell -ExecutionPolicy Bypass -File deploy\windows\backup.ps1 -Tag manual -Offsite   # sekaligus salin ke luar disk
```
`deploy.ps1` selalu membuat backup `predeploy-<commit>` sebelum migrasi.

### 8.4 Restore
**Uji restore** (aman, produksi tidak disentuh — lakukan **sebulan sekali**):
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1                      # backup terbaru
powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1 -File <path>.dump
```
Dipulihkan ke database `smartwms_restore_test`, jumlah baris per tabel dibandingkan dengan produksi,
lalu database uji dihapus (`-Keep` untuk membiarkannya dan melihatnya di pgAdmin).

**Restore produksi** (data sesudah waktu backup HILANG):
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1 -Production -File C:\SmartWMS\backups\smartwms_....dump
```
Urutan: konfirmasi ketik `RESTORE` → backup pengaman `pra-restore` → stop aplikasi → database
dibuat ulang (role & hak akses) → isi backup dipulihkan → zona waktu UTC dipasang lagi → start →
cek health. Setelah itu jalankan ulang `setup-viewer.ps1` bila akun baca-saja dipakai.

Keduanya meminta password superuser `postgres`.

### 8.5 Detail teknis
- Format `pg_dump --format=custom` (terkompresi, bisa dipulihkan per tabel dengan `pg_restore -t`).
- Ditulis ke `.partial` dulu, diverifikasi `pg_restore --list`, baru diganti nama → file `.dump`
  selalu utuh.
- Dump memakai role owner produksi (`migrate.env`), restore memakai `--no-owner --single-transaction
  --exit-on-error` (gagal = tidak ada perubahan setengah jadi).
- `pg_dump` tidak menyimpan setelan per-database → restore memasang ulang `timezone = UTC` (D-22).
- Log: `C:\SmartWMS\logs\backup.log`; status terakhir: `<folder backup>\last-backup.json`.

---

## 9. Akun database baca-saja (pgAdmin)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\setup-viewer.ps1
```
Membuat `smartwms_viewer` (hanya SELECT, semua transaksi read-only, D-36) dan menampilkan
passwordnya **sekali**. Cara memakai di pgAdmin: [`MANUAL-ADMIN-SERVER.md`](MANUAL-ADMIN-SERVER.md) §6.
