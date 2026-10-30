# Manual Admin Server — SmartWMS V2

> Panduan harian untuk orang yang menjaga PC server SmartWMS: menyalakan, me-restart, mengecek,
> masuk ke database, backup & restore, dan menangani masalah umum.
> Versi 30 Oktober 2026. Detail teknis & instalasi awal: [`DEPLOY-LOKAL.md`](DEPLOY-LOKAL.md).

---

## 1. Kenali servernya

| Hal | Isi |
|---|---|
| Alamat aplikasi | `http://<IP-server>:3000` — IP terlihat di `status.ps1` (contoh: `http://192.168.1.21:3000`) |
| Dari PC server sendiri | `http://localhost:3000` |
| Aplikasi | Windows Service **SmartWMS** (menyala otomatis) |
| Database | Windows Service **postgresql-x64-18**, database `smartwms` |
| Folder server | `C:\SmartWMS` (jangan diubah manual) |
| Folder repo (script) | `D:\BABAYAGA\HMM\project\smart-wmsV2` |
| Backup | `D:\backup-database` (di server ini; bawaan `C:\SmartWMS\backups`) + salinan luar disk (lihat §7) |
| Log | `C:\SmartWMS\logs` |

**Aturan emas:** server = PC yang harus menyala selama jam kerja. Jangan dimatikan paksa (cabut
listrik / tahan tombol power) kecuali benar-benar hang.

---

## 2. Membuka PowerShell Administrator

Hampir semua perintah di manual ini dijalankan di sini.

1. Klik kanan tombol **Start** → **Terminal (Admin)** → klik **Yes** di jendela UAC.
2. Pindah ke folder repo:
   ```powershell
   cd D:\BABAYAGA\HMM\project\smart-wmsV2
   ```

Perintah script selalu diawali `powershell -ExecutionPolicy Bypass -File ...` — salin apa adanya.

---

## 3. Mengecek server sehat atau tidak

**Cara cepat (tanpa PowerShell):** buka `http://localhost:3000/api/health` di browser PC server.
- `{"status":"ok", ... "db":"ok"}` → sehat
- Halaman tidak terbuka → aplikasi mati (§4)
- `"db":"down"` → database bermasalah (§4.3)

**Cara lengkap:**
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\status.ps1
```
Menampilkan: status kedua service, versi aplikasi yang jalan, alamat LAN, backup terakhir, salinan
luar disk, sisa disk, dan 5 baris terakhir log error. Baris kuning (`!!`) = perlu perhatian.

---

## 4. Menyalakan, mematikan, me-restart

### 4.1 Menyalakan server
Cukup **nyalakan PC**. Database dan aplikasi menyala sendiri — **tidak perlu login Windows**.
Tunggu ±1 menit setelah Windows tampil, lalu cek §3.

### 4.2 Aplikasi (service SmartWMS)

| Mau apa | PowerShell Admin | Lewat tampilan Windows |
|---|---|---|
| Lihat status | `Get-Service SmartWMS` | Tekan `Win + R` → ketik `services.msc` → Enter → cari **SmartWMS V2** |
| Restart (aplikasi lambat/aneh) | `Restart-Service SmartWMS` | Klik kanan **SmartWMS V2** → Restart |
| Matikan sementara | `Stop-Service SmartWMS` | Klik kanan → Stop |
| Nyalakan | `Start-Service SmartWMS` | Klik kanan → Start |

Restart aplikasi memutus pengguna ±10 detik; sesi login tetap tersimpan (tidak perlu login ulang).
Bila aplikasi crash, Windows otomatis menyalakannya lagi (10 detik, 30 detik, lalu 2 menit).

### 4.3 Database (service postgresql-x64-18)
Sama seperti di atas dengan nama `postgresql-x64-18`. Me-restart database **ikut memutus aplikasi**
beberapa detik; aplikasi tersambung lagi sendiri.
```powershell
Restart-Service postgresql-x64-18
```

### 4.4 Restart / mematikan PC
Pakai Start → Power → **Restart** / **Shut down** seperti biasa. Windows menghentikan aplikasi &
database dengan rapi. Lakukan di luar jam kerja bila bisa, lalu cek §3 setelah menyala.

**Windows Update:** pastikan *Active hours* = jam kerja (Settings → Windows Update → Advanced
options) supaya PC tidak restart sendiri saat dipakai.

---

## 5. Pengguna tidak bisa membuka aplikasi dari PC lain

| Cek | Cara |
|---|---|
| Server sehat? | §3 di PC server |
| IP server berubah? | `status.ps1` → bandingkan dengan alamat yang dipakai pengguna. Solusi permanen: DHCP reservation di router (DEPLOY-LOKAL §3.5) |
| Pengguna memakai IP yang benar? | Pakai IP **Ethernet** (baris "URL LAN" di `status.ps1`), bukan IP Wi-Fi/dongle |
| Ethernet berprofil **Public**? | `status.ps1` memperingatkan. Perbaiki: `Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private`. **Jangan** ubah Wi-Fi/internet umum jadi Private |
| PC pengguna beda jaringan (mis. Wi-Fi tamu)? | Harus satu jaringan kantor dengan server |
| Antivirus pihak ketiga memblokir? | Izinkan port TCP 3000 masuk |

---

## 6. Masuk ke database

### 6.1 Untuk MELIHAT data (disarankan) — akun baca-saja
Buat akunnya sekali:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\setup-viewer.ps1
```
Catat password yang tampil (hanya tampil sekali; tersimpan juga di `C:\SmartWMS\config\secrets.env`).
Akun ini **tidak bisa mengubah/menghapus data** — aman untuk melihat isi tabel atau membuat laporan.

**pgAdmin 4** (terpasang bersama PostgreSQL; cari "pgAdmin 4" di Start):
1. Klik kanan **Servers** → **Register** → **Server…**
2. Tab *General* → Name: `SmartWMS produksi`
3. Tab *Connection*: Host `localhost` · Port `5432` · Maintenance database `smartwms` ·
   Username `smartwms_viewer` · Password (dari langkah di atas) · centang *Save password* bila PC
   hanya dipakai admin
4. Save → buka **SmartWMS produksi → Databases → smartwms → Schemas → public → Tables**
5. Klik kanan tabel → **View/Edit Data → First 100 Rows**, atau **Tools → Query Tool** untuk SQL

Tabel penting: `surat_jalan` & `surat_jalan_items` (SJ), `assets_raw` & `assets_clean` (DAT),
`lpp_raw` (LPP), `asset_notes` (catatan monitoring), `sj_tujuan` (master tujuan),
`app_users` (akun aplikasi).

### 6.2 Untuk MENGUBAH data — akun postgres (hati-hati)
Hanya bila benar-benar perlu (mis. §8). Password `postgres` = yang dibuat saat instal PostgreSQL.
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d smartwms
```
Ketik SQL lalu Enter, keluar dengan `\q`. **Sebelum mengubah data, buat backup manual (§7.3).**
Jangan pernah menjalankan `DELETE`/`UPDATE` tanpa `WHERE`.

Database `smartwms_dev` adalah database **development** — bukan data yang dipakai pengguna.

---

## 7. Backup

### 7.1 Yang berjalan otomatis
- Setiap hari jam **18:30** (bila PC mati, begitu PC menyala) → folder backup (`D:\backup-database`), disimpan 14 hari
- Seminggu sekali disalin ke **luar disk** (hardisk eksternal / folder lain) bila tujuannya terhubung
- Setiap update aplikasi (`deploy.ps1`) → backup `predeploy-...` sebelum database diubah

### 7.2 Memastikan backup jalan (seminggu sekali)
`status.ps1` → bagian **Backup**:
- *Terakhir* harus kurang dari ±1 hari (hijau)
- *Luar disk* kurang dari 8 hari. Bila kuning → colokkan hardisk eksternal; salinan dibuat pada
  backup berikutnya, atau langsung: §7.3 dengan `-Offsite`

Riwayat lengkap: `C:\SmartWMS\logs\backup.log`. Jadwal juga terlihat di **Task Scheduler** →
Task Scheduler Library → **SmartWMS Backup Harian** (kolom *Last Run Result* `0x0` = berhasil).

### 7.3 Backup manual (sebelum pekerjaan berisiko)
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\backup.ps1 -Tag manual
powershell -ExecutionPolicy Bypass -File deploy\windows\backup.ps1 -Tag manual -Offsite   # + salin ke luar disk
```

### 7.4 Uji restore (sebulan sekali — backup yang belum pernah diuji belum tentu bisa dipakai)
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1
```
Aman: memulihkan backup terbaru ke database **terpisah** `smartwms_restore_test`, membandingkan
jumlah baris tiap tabel dengan data sekarang, lalu menghapus database uji. Hasil normal: semua
tabel terbaca; angka boleh sedikit beda bila ada input setelah jam backup.

### 7.5 Mengembalikan data (restore produksi) — keadaan darurat
Misalnya data terhapus massal atau rusak. **Semua input sesudah waktu backup akan hilang.**
1. Beri tahu pengguna untuk berhenti input.
2. Pilih file di `D:\backup-database` (nama berisi tanggal & jam, mis. `smartwms_20261030-183000_harian.dump`).
3. ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1 -Production -File D:\backup-database\<nama-file>.dump
   ```
4. Ketik `RESTORE` saat diminta, lalu password `postgres`.
5. Script membuat backup pengaman dulu, mematikan aplikasi, memulihkan data, menyalakan lagi.
6. Bila akun baca-saja dipakai: jalankan ulang `setup-viewer.ps1`.

---

## 8. Akun pengguna aplikasi

Normalnya semua lewat menu **Manajemen User** (Super Admin): menyetujui pendaftar, mengubah
role, menonaktifkan, **reset password** (password sementara, wajib diganti saat login).

Bila **tidak ada Super Admin yang bisa login** (lupa password / terkunci), pakai §6.2:

```sql
-- Buka kunci setelah 5x salah password (atau tunggu 10 menit)
update app_users set failed_login_count = 0, locked_until = null where username = 'nama';

-- Jadikan akun lain Super Admin aktif (daftar dulu lewat halaman /register)
update app_users set role = 'super_admin', status = 'active' where username = 'nama';
```
Setelah bisa masuk, reset password akun yang lupa lewat Manajemen User.

---

### 8.1 Warna tampilan pengguna
Setiap pengguna bisa mengatur warnanya sendiri (ikon palet di kanan atas → **Warna tampilan**).
Bila seorang pengguna membuat warna yang membuat layarnya tidak terbaca, minta dia membuka
`http://<IP-server>:3000/pengaturan/tema?reset-theme` lalu menekan **Kembalikan ke bawaan**.
Bisa juga dari database (§6.2): `update app_users set theme_custom = null where username = 'nama';`
(berlaku setelah pengguna memuat ulang halaman).

## 9. Update aplikasi & membatalkannya

Dikerjakan developer (Fillian) setelah perubahan di-push ke GitHub:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\deploy.ps1
```
±2–5 menit; aplikasi terputus ±10–20 detik. Bila versi baru bermasalah, script otomatis kembali
ke versi lama. Membatalkan manual:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1 -List   # daftar versi
powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1         # ke versi sebelumnya
```

---

## 10. Log

| File | Isi |
|---|---|
| `C:\SmartWMS\logs\SmartWMS.out.log` | Catatan normal aplikasi |
| `C:\SmartWMS\logs\SmartWMS.err.log` | **Error aplikasi** — lihat ini pertama kali bila ada masalah |
| `C:\SmartWMS\logs\SmartWMS.wrapper.log` | Kapan service dinyalakan / dimatikan / di-restart otomatis |
| `C:\SmartWMS\logs\backup.log` | Riwayat backup & restore |
| `C:\Program Files\PostgreSQL\18\data\log\` | Log database (termasuk query lambat > 1 detik) |

Folder `C:\SmartWMS` hanya bisa dibuka Administrator (Explorer akan meminta izin — klik Continue).
Saat melapor masalah ke developer, sertakan output `status.ps1` dan isi `SmartWMS.err.log`.

---

## 11. Jadwal perawatan

| Kapan | Tugas |
|---|---|
| Setiap hari | Tidak ada — semua otomatis. Cukup pastikan PC menyala di jam kerja |
| Seminggu sekali | `status.ps1`: backup < 1 hari, luar disk < 8 hari, disk bebas > 10 GB; colokkan hardisk eksternal bila perlu |
| Sebulan sekali | Uji restore (§7.4); Windows Update + restart di luar jam kerja, lalu cek §3; lihat `SmartWMS.err.log` |
| Saat ganti RAM / perangkat keras | Matikan PC normal (§4.4); setelah menyala cek §3 |

---

## 12. Keadaan darurat: PC server rusak / instal ulang Windows

1. Siapkan PC (bisa PC lain): instal **PostgreSQL 18**, **Node.js 24 LTS**, **Git for Windows**.
2. Clone repo / salin folder repo, lalu ikuti DEPLOY-LOKAL §3.2–3.3 (`setup-server.ps1`, `deploy.ps1`).
3. Ambil backup terbaru dari **salinan luar disk** (atau `D:\backup-database` bila disk lama masih
   terbaca), lalu restore produksi (§7.5).
4. `setup-backup.ps1` (dengan `-OffsiteDir`), `setup-viewer.ps1` bila perlu.
5. Perbarui DHCP reservation dengan MAC PC baru → alamat untuk pengguna tetap sama.

---

## 13. Password & rahasia — di mana?

| Rahasia | Lokasi | Siapa yang perlu tahu |
|---|---|---|
| Password superuser `postgres` | Dibuat saat instal PostgreSQL — **simpan di password manager / amplop tersegel** | Admin server |
| Password database aplikasi & migrasi | `C:\SmartWMS\config\secrets.env` (dibuat otomatis, hanya Administrator) | Tidak ada — dipakai script |
| Password akun baca-saja `smartwms_viewer` | Tampil sekali saat `setup-viewer.ps1`; juga di `secrets.env` | Yang membuka pgAdmin |
| Akun aplikasi (Super Admin) | Di database; reset lewat Manajemen User | Super Admin |

Jangan kirim isi `C:\SmartWMS\config` lewat chat/email, dan jangan masukkan ke repo GitHub.
