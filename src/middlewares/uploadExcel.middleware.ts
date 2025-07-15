import multer from 'multer';
import path from 'path';

// Dung lượng tối đa: 50MB
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// Cấu hình bộ nhớ tạm: lưu file vào thư mục 'uploads'
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// Bộ lọc file: chỉ cho phép CSV, Excel
function fileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const allowedTypes = ['.csv', '.xls', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file .csv, .xls, .xlsx'));
  }
}

// Khởi tạo middleware multer
export const uploadExcel = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});
