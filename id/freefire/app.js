// Mengimpor Supabase langsung via CDN (ESM Module)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ==========================================
// 1. KONFIGURASI SUPABASE & WA SENDER
// ==========================================
const supabaseUrl = 'URL_SUPABASE_ANDA' 
const supabaseAnonKey = 'KEY_ANON_SUPABASE'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const WA_SENDER_API_URL = 'https://app.wasender.dev/api/send'
const WA_SENDER_API_KEY = 'API_KEY_WASENDER' // Dapatkan dari dashboard wasender
const WA_ADMIN_NUMBER = '628xxxxxxxxxx' // Nomor penerima notif (Gunakan format 62)

// ==========================================
// 2. LOGIKA NOTIFIKASI WHATSAPP
// ==========================================
async function sendWANotification(type, detail) {
    let message = "";
    if(type === 'login') {
        message = `🔔 *Notifikasi Login Baru*\nSeseorang baru saja login ke sistem.\nWaktu: ${new Date().toLocaleString()}`;
    } else if (type === 'beli') {
        message = `💰 *Pesanan Baru Masuk!*\nProduk: ${detail.nama}\nHarga: Rp ${detail.harga}\nSegera proses pesanan ini.`;
    }

    try {
        const response = await fetch(WA_SENDER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: WA_ADMIN_NUMBER,
                message: message,
                apikey: WA_SENDER_API_KEY
            })
        });
        const result = await response.json();
        console.log("Status Notif WA:", result);
    } catch (error) {
        console.error("Gagal mengirim WA:", error);
    }
}

// Simulasi Event Tombol Beli di detail.html
const btnBeli = document.getElementById('btn-beli');
if(btnBeli) {
    btnBeli.addEventListener('click', () => {
        // Ambil data dari DOM
        const title = document.getElementById('detail-title').innerText;
        const price = document.getElementById('detail-price').innerText;
        
        sendWANotification('beli', { nama: title, harga: price });
        alert('Memproses pembelian... Notifikasi WA telah dikirim ke Admin!');
    });
}

// ==========================================
// 3. LOGIKA SUPABASE REALTIME (Untuk akun.html)
// ==========================================
const productContainer = document.getElementById('product-container');
const totalProdukLabel = document.getElementById('total-produk');

// Render Card HTML
function createProductCard(product) {
    return `
    <a href="detail.html?id=${product.id}" class="bg-white rounded-2xl p-2.5 shadow-sm border border-gray-100 flex flex-col justify-between animate-fade-in hover:border-blue-300 transition-all cursor-pointer">
        <div>
            <div class="relative rounded-xl overflow-hidden mb-2 aspect-video bg-indigo-950">
                <img src="${product.image_url || 'https://placehold.co/400x250/2e1065/ffffff?text=Akun+FF'}" alt="${product.name}" class="w-full h-full object-cover">
            </div>
            <h2 class="text-xs font-bold text-gray-800 line-clamp-2 leading-tight">${product.name}</h2>
            <p class="text-[10px] text-gray-400 mt-0.5">Akun</p>
            <div class="inline-flex items-center gap-1 bg-emerald-100/60 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-bold mt-1.5">
                <i class="fa-solid fa-bolt text-[9px]"></i> Instan
            </div>
        </div>
        <div class="mt-3">
            <p class="text-sm font-extrabold text-orange-600">Rp ${product.price.toLocaleString('id-ID')}</p>
            <div class="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                <span>${product.sold || 0} Terjual</span>
                <span class="flex items-center text-gray-700 font-semibold">
                    <i class="fa-solid fa-star text-amber-400 text-[9px] mr-0.5"></i> ${product.rating || '0.0'}
                </span>
            </div>
        </div>
    </a>`;
}

// Fetch data awal dan subscribe realtime (Hanya jalan jika ada elemen container)
if(productContainer) {
    async function loadProducts() {
        // Ambil data awal dari tabel 'produk'
        const { data, error } = await supabase.from('produk').select('*').order('created_at', { ascending: false });
        if (error) console.error(error);
        else renderProducts(data);
    }

    function renderProducts(data) {
        productContainer.innerHTML = '';
        if(totalProdukLabel) totalProdukLabel.innerText = data.length;
        
        data.forEach(prod => {
            productContainer.innerHTML += createProductCard(prod);
        });
    }

    // Subscribe ke perubahan data realtime di tabel 'produk'
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produk' }, (payload) => {
        console.log('Realtime Change Received!', payload);
        // Refresh data saat ada perubahan (insert/update/delete)
        loadProducts(); 
    })
    .subscribe();

    // Inisialisasi muat data
    loadProducts();
}

// ==========================================
// 4. FITUR UPLOAD FOTO (Untuk User Terverifikasi)
// ==========================================
// Fungsi ini bisa dipanggil di form upload pada dashboard seller
async function uploadStockPhoto(file, userId) {
    // 1. Cek apakah user terverifikasi (Asumsi: ada tabel users dengan kolom is_verified)
    const { data: user, error: userErr } = await supabase.from('users').select('is_verified').eq('id', userId).single();
    
    if (userErr || !user.is_verified) {
        alert("Akses ditolak: Akun belum terverifikasi untuk upload stok foto.");
        return;
    }

    // 2. Upload file ke Supabase Storage (Asumsi nama bucket: 'stock_akun')
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('stock_akun').upload(filePath, file);

    if (uploadError) {
        console.error("Gagal upload foto:", uploadError);
        alert("Gagal mengupload foto stok.");
    } else {
        alert("Foto stok berhasil diupload!");
        // Dapatkan URL publik gambar untuk dimasukkan ke database produk
        const { data: publicUrl } = supabase.storage.from('stock_akun').getPublicUrl(filePath);
        return publicUrl.publicUrl;
    }
}
// ==========================================
// LOGIKA PEMBELIAN (Cek Login)
// ==========================================
const btnBeli = document.getElementById('btn-beli');

if (btnBeli) {
    btnBeli.addEventListener('click', async () => {
        // 1. Cek apakah ada user yang sedang login di Supabase
        const { data: { user }, error } = await supabase.auth.getUser();

        // 2. Jika tidak ada user (belum login/daftar)
        if (!user || error) {
            alert('Kamu harus Mendaftar atau Masuk (Login) terlebih dahulu untuk membeli akun ini!');
            // Arahkan ke halaman login (contoh)
            // window.location.href = 'login.html';
            return; 
        }

        // 3. Jika sudah login, ambil data produk dari HTML
        const title = document.getElementById('detail-title').innerText;
        const price = document.getElementById('detail-price').innerText;
        
        // 4. Kirim Notifikasi WA ke Admin/Penjual
        sendWANotification('beli', { nama: title, harga: price, pembeli: user.email });
        
        alert('Memproses pembelian... Notifikasi WA telah dikirim ke Admin!');
        // Di sini biasanya dilanjutkan ke halaman pembayaran (Checkout)
    });
}
// ==========================================
// FITUR TAMBAH PRODUK (Khusus Akun Terverifikasi)
// ==========================================
async function tambahProdukAkun(fileGambar, detailProduk) {
    // 1. Pastikan user sedang login
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Silakan login terlebih dahulu!");
        return;
    }

    // 2. Cek apakah akun user ini "Terverifikasi" di tabel profiles/users
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', user.id)
        .single();
    
    if (profileErr || !profile.is_verified) {
        alert("Akses ditolak: Hanya Penjual Terverifikasi yang dapat menambah akun!");
        return;
    }

    // 3. Upload Foto ke Storage Supabase
    const fileExt = fileGambar.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('stock_akun')
        .upload(filePath, fileGambar);

    if (uploadError) {
        alert("Gagal mengupload foto stok.");
        return;
    }

    // Dapatkan URL publik dari gambar yang baru diupload
    const { data: publicUrlData } = supabase.storage
        .from('stock_akun')
        .getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;

    // 4. Masukkan semua detail akun + URL gambar ke tabel 'produk'
    const { data: produkBaru, error: insertError } = await supabase
        .from('produk')
        .insert([
            { 
                penjual_id: user.id,
                name: detailProduk.judul,
                price: detailProduk.harga,
                description: detailProduk.deskripsi,
                spesifikasi: detailProduk.spesifikasi, // contoh: level, rank, dll
                image_url: imageUrl,
                rating: 0,
                sold: 0
            }
        ]);

    if (insertError) {
        console.error(insertError);
        alert("Gagal menyimpan detail produk ke database.");
    } else {
        alert("Produk akun berhasil ditambahkan! Produk akan otomatis muncul di beranda.");
        // Data akan langsung terdeteksi oleh Supabase Realtime di akun.html
    }
}