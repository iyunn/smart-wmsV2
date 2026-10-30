# DEPLOY-LOKAL — Runbook Server SmartWMS V2

> Cara memasang, memperbarui, dan merawat SmartWMS V2 di PC server kantor (Windows 11).
> Dibuat: 30 Oktober 2026 (Tahap 6a). Keputusan teknis: `ARCHITECTURE.md` D-12, D-20, D-32–D-34.
> Bagian **Backup & restore** dilengkapi di Tahap 6b.

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
| `C:\SmartWMS\backups` | Backup database (Tahap 6b) | Administrator |

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

### 3.4 Isi data
Database produksi masih kosong. Selama V1 masih dipakai, data diisi saat **cutover** (Tahap 7) dengan
`db:import-v1` ke database `smartwms`. Untuk mencoba lebih awal, daftar akun di `/register` lalu
aktifkan lewat SQL (pgAdmin, database `smartwms`):
`update app_users set status = 'active', role = 'super_admin' where username = '<nama>';`

### 3.5 Jaringan
- **IP tetap:** di router kantor buat *DHCP reservation* untuk MAC yang dicetak `setup-server.ps1`
  (atau `status.ps1`). Tanpa ini alamat `http://<IP>:3000` bisa berubah setelah restart router.
- **Profil jaringan harus Private/Domain.** Bila Public, PC lain tidak bisa akses:
  Settings → Network & internet → (Ethernet/Wi-Fi) → Network profile type → **Private network**.
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

Yang terjadi: build di `C:\SmartWMS\src` → folder rilis baru → (backup, Tahap 6b) → stop service →
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
database dari backup (Tahap 6b).

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
| PC lain tidak bisa membuka `http://<IP>:3000` | Profil jaringan Public; IP berubah; firewall pihak ketiga | Ubah ke Private (§3.5); cek IP di `status.ps1`; buka port 3000 di antivirus bila ada |
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

## 8. Backup & restore

> Dilengkapi di Tahap 6b: `pg_dump` harian (Task Scheduler, retensi 14 hari), salinan mingguan ke
> luar disk server, backup otomatis sebelum setiap deploy, dan prosedur restore yang sudah diuji.
