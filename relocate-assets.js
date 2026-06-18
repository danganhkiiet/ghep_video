const fs = require('fs');
const path = require('path');

// Usage Guide
function printUsage() {
    console.log(`
============================================================
HƯỚNG DẪN DI CHUYỂN THƯ MỤC DỰ ÁN LÊN GOOGLE DRIVE
============================================================
Công cụ này sẽ giúp bạn di chuyển các thư mục chứa ảnh, âm thanh tải lên (uploads)
và video kết quả (exports) sang ổ đĩa Google Drive của bạn (ví dụ: ổ G:\\).
Sau đó tạo liên kết ảo (Junction Link) để ứng dụng vẫn đọc/ghi bình thường
mà không tốn dung lượng ổ đĩa cứng cục bộ.

CÁCH SỬ DỤNG:
node relocate-assets.js "<Đường dẫn đến thư mục Google Drive>"

VÍ DỤ:
node relocate-assets.js "G:\\My Drive\\ghep_video_assets"
(Lưu ý: Bạn cần cài đặt Google Drive Desktop để có ổ đĩa ảo G:\\)
============================================================
`);
}

const targetBase = process.argv[2];

if (!targetBase) {
    printUsage();
    process.exit(0);
}

// Helper to recursively copy directories
function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function run() {
    try {
        console.log(`Đang kiểm tra thư mục đích trên Google Drive: "${targetBase}"...`);
        if (!fs.existsSync(targetBase)) {
            console.log(`Thư mục chưa tồn tại, đang tiến hành tạo mới...`);
            fs.mkdirSync(targetBase, { recursive: true });
        }

        const localUploads = path.join(__dirname, 'uploads');
        const localExports = path.join(__dirname, 'exports');
        const targetUploads = path.join(targetBase, 'uploads');
        const targetExports = path.join(targetBase, 'exports');

        const timestamp = Date.now();
        const backupUploads = path.join(__dirname, `uploads_backup_${timestamp}`);
        const backupExports = path.join(__dirname, `exports_backup_${timestamp}`);

        // 1. Sao chép uploads lên Drive
        if (fs.existsSync(localUploads) && !fs.lstatSync(localUploads).isSymbolicLink()) {
            console.log(`1/4. Đang sao chép các tệp tin trong uploads lên Google Drive...`);
            copyDirSync(localUploads, targetUploads);
            console.log(`    -> Đã sao chép uploads hoàn tất.`);
        } else {
            console.log(`1/4. Bỏ qua sao chép uploads (thư mục trống hoặc đã là liên kết ảo).`);
        }

        // 2. Sao chép exports lên Drive
        if (fs.existsSync(localExports) && !fs.lstatSync(localExports).isSymbolicLink()) {
            console.log(`2/4. Đang sao chép các tệp tin trong exports lên Google Drive...`);
            copyDirSync(localExports, targetExports);
            console.log(`    -> Đã sao chép exports hoàn tất.`);
        } else {
            console.log(`2/4. Bỏ qua sao chép exports (thư mục trống hoặc đã là liên kết ảo).`);
        }

        // 3. Đổi tên thư mục gốc để làm backup
        console.log(`3/4. Đang đổi tên các thư mục cục bộ cũ làm bản backup an toàn...`);
        if (fs.existsSync(localUploads) && !fs.lstatSync(localUploads).isSymbolicLink()) {
            fs.renameSync(localUploads, backupUploads);
            console.log(`    -> Đã đổi tên 'uploads' thành '${path.basename(backupUploads)}'`);
        }
        if (fs.existsSync(localExports) && !fs.lstatSync(localExports).isSymbolicLink()) {
            fs.renameSync(localExports, backupExports);
            console.log(`    -> Đã đổi tên 'exports' thành '${path.basename(backupExports)}'`);
        }

        // 4. Tạo Junction Link trỏ cục bộ sang Google Drive
        console.log(`4/4. Đang tạo liên kết ảo (Junction Link) sang Google Drive...`);
        
        // Đảm bảo thư mục đích tồn tại trước khi tạo link
        if (!fs.existsSync(targetUploads)) {
            fs.mkdirSync(targetUploads, { recursive: true });
        }
        if (!fs.existsSync(targetExports)) {
            fs.mkdirSync(targetExports, { recursive: true });
        }

        fs.symlinkSync(targetUploads, localUploads, 'junction');
        console.log(`    -> Liên kết ảo 'uploads' -> '${targetUploads}' thành công.`);

        fs.symlinkSync(targetExports, localExports, 'junction');
        console.log(`    -> Liên kết ảo 'exports' -> '${targetExports}' thành công.`);

        console.log(`
============================================================
DI CHUYỂN DỰ ÁN LÊN GOOGLE DRIVE THÀNH CÔNG!
============================================================
- Toàn bộ dữ liệu ảnh/âm thanh tải lên và video render hiện tại
  đã nằm an toàn trên Google Drive của bạn.
- Bạn có thể xóa các thư mục backup cũ dưới đây để giải phóng ổ cứng cục bộ:
  [XÓA ĐƯỢC] Thư mục: ${backupUploads}
  [XÓA ĐƯỢC] Thư mục: ${backupExports}
- Kể từ bây giờ, tất cả các tệp tải lên và video xuất ra mới
  sẽ lưu trực tiếp lên Google Drive mà không tốn dung lượng ổ đĩa máy tính!
============================================================
`);

    } catch (error) {
        console.error('\n[LỖI] Quá trình di chuyển thất bại:', error);
    }
}

run();
