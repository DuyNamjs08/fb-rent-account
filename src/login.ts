import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
  });

  const page = await context.newPage();
  await page.goto('https://www.facebook.com');

  console.log('➡️ Đăng nhập Facebook thủ công rồi nhấn Enter để tiếp tục...');

  process.stdin.once('data', async () => {
    // Chỉ lấy cookies thay vì toàn bộ storage
    const cookies = await context.cookies();

    // Lưu cookies vào file JSON
    fs.writeFileSync('fb-cookies.json', JSON.stringify(cookies, null, 2));

    console.log('✅ Đã lưu cookies vào fb-cookies.json');
    console.log(`📊 Số lượng cookies: ${cookies.length}`);

    await browser.close();
    process.exit();
  });
})();
