// config.js
// === Trung tâm cấu hình cho toàn hệ thống ===
// Mọi trang chỉ cần: const { SHEET_API, BANKS_FOLDER_ID, MATERIALS_FOLDER_ID } = window.CTCT_CONFIG;

window.CTCT_CONFIG = {
  // URL /exec của Apps Script (đặt chế độ Anyone)
  SHEET_API: 'https://script.google.com/macros/s/AKfycbydHnxla7Tqc3QI2kUSzbRe7ZIzoi7rY9fRbgHokZnCObQRXUZNkTRMZZppCNthANN_9A/exec',

  // Thư mục ngân hàng câu hỏi (Drive)
  BANKS_FOLDER_ID: '1_-YhEHfYfF957yC6o-xyiPk06XRheKb6',

  // Thư mục tài liệu học tập (Drive)
  MATERIALS_FOLDER_ID: '14Vwo5fxjSHtxu9mDOvNUDQrnve6pvrfK',
  
  // Thư mục up ảnh và văn bản (Drive)
  UPLOAD_FOLDER_ID: '1MlQBO1_PAR6wNUPsEzMgIKWBKUlEZQBC',

  // API THI THỬ – URL của web app vừa deploy ở trên
  TRY_SHEET_API: 'https://script.google.com/macros/s/AKfycbz1kfFnl_G1NihDvbBcE-p_UuLvzRq11LKnQg5BgoztV3y1xHoXi2BiF1AOdwL6zr49/exec',

  // (khuyến nghị) FOLDER ngân hàng đề cho 2 đối tượng
  BANK_DQTV: '1RGLds-9IKHztD3_GxRrE5mSDFsjML3j9',
  BANK_LLTT: '1dANLZeGs4UR4dTTbeH0QYUDl32OKqfEp',
    // Tùy chọn (nếu cần mở rộng sau này)
  APP_VERSION: '2025-09-18'

};
