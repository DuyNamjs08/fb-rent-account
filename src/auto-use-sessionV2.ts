import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

export const autoChangeLimitSpend = async (data: any) => {
  const { bm_id = '', ads_account_id = '', amountPoint = 0 } = data;
  const browser = await chromium.launch({
    headless: false,
    // proxy: {
    //   server: 'http://proxy.example.com:8000',
    //   username: 'proxy_user',
    //   password: 'proxy_pass',
    // },
    slowMo: 120, // Tự động chậm lại giữa mỗi thao tác
  });
  let result = 0;
  // Đường dẫn cookie cũ và mới
  const oldCookiesPath = path.resolve(__dirname, '../fb-cookies.json'); // cookies dạng Playwright  // cookies dạng array
  const storageStatePath = path.resolve(
    __dirname,
    '../fb-cookies-browser.json',
  );
  // Nếu file cookies cũ tồn tại nhưng chưa đúng định dạng storageState, thì chuyển đổi
  if (fs.existsSync(oldCookiesPath) && !fs.existsSync(storageStatePath)) {
    console.log('⚙️ Đang chuyển đổi cookie cũ sang định dạng Playwright...');
    const rawCookies = JSON.parse(fs.readFileSync(oldCookiesPath, 'utf-8'));
    const storageState = {
      cookies: rawCookies,
      origins: [],
    };
    fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
    console.log('✅ Đã tạo file storageState:', storageStatePath);
  }
  let context: BrowserContext;
  if (fs.existsSync(storageStatePath)) {
    console.log('✅ Tìm thấy file cookies, đang load...');
    try {
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1280, height: 800 },
        locale: 'vi-VN',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.5993.90 Safari/537.36',
      });
      console.log('🔄 Đã load session thành công');
    } catch (error: any) {
      console.log('⚠️ Lỗi khi load session:', error.message);
      console.log('🔄 Tạo context mới...');
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: 'vi-VN',
      });
    }
  } else {
    console.log('⚠️ Không tìm thấy file cookies, tạo context mới');
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'vi-VN',
    });
  }
  const page = await context.newPage();
  await page.goto(
    `https://business.facebook.com/billing_hub/accounts/details?asset_id=${ads_account_id}&business_id=${bm_id}&placement=standalone`,
  );
  await page.waitForLoadState('networkidle');

  try {
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('❌ Chưa đăng nhập - cần đăng nhập thủ công');
    await page.waitForTimeout(20000);
    await context.storageState({ path: storageStatePath });
    console.log('💾 Đã lưu session mới vào:', storageStatePath);
  } catch {
    console.log('✅ Đã đăng nhập thành công!');
  }

  await page.waitForTimeout(1500);
  const heading = page.locator('div[role="heading"][aria-level="3"]', {
    hasText: 'Giới hạn chi tiêu cho tài khoản',
  });
  await heading.scrollIntoViewIfNeeded({ timeout: 400 });
  await page.waitForTimeout(1000);

  try {
    const allSpans = page.locator(
      'span.x8t9es0.x1fvot60.xxio538.x1heor9g.xq9mrsl.x1h4wwuj.x1pd3egz.xeuugli.xh8yej3',
    );
    const count = await allSpans.count();
    console.log(`🔎 Tìm thấy ${count} phần tử.`);
    if (count === 16) {
      // Click vào tất cả hoặc chỉ phần tử đầu
      await allSpans.nth(14).scrollIntoViewIfNeeded();
      await allSpans.nth(14).click({ delay: 200 });
      console.log(
        '✅ Đã click vào phần tử đầu tiên trong danh sách 14 phần tử.',
      );
    } else {
      console.log('⚠️ Số lượng phần tử KHÔNG PHẢI là 14, không click.');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click vào phần tử:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const button = page.locator('span', { hasText: /^Đặt giới hạn$/ });
    await button.waitFor({ state: 'visible', timeout: 5000 });
    await button.scrollIntoViewIfNeeded();
    await button.click({ delay: 200 });
    console.log('✅ Đã click vào nút "Đặt giới hạn"');
  } catch (err: any) {
    console.error('❌ Không thể click vào nút "Đặt giới hạn":', err.message);
  }
  await page.waitForTimeout(1200);
  try {
    const label = page.locator(
      'label:has(span:text("Thời điểm đặt lại giới hạn"))',
    );
    await label.click({ delay: 200 });
    console.log('✅ Đã click vào nút "Thời điểm đặt lại giới hạn"');
  } catch (err: any) {
    console.error(
      '❌ Không thể click vào nút "Thời điểm đặt lại giới hạn":',
      err.message,
    );
  }
  await page.waitForTimeout(1200);
  try {
    const target = page.locator('span', {
      hasText: /^Thủ công, chỉ khi tôi thay đổi$/,
    });
    await target.waitFor({ state: 'visible' });
    await target.click({ delay: 200, force: true });
    console.log('✅ Đã click vào nút "Thủ công"');
  } catch (err: any) {
    console.error('❌ Không thể click vào nút "Thủ công":', err.message);
  }

  await page.waitForTimeout(1500);
  try {
    const input = await page.locator('input[name="accountSpendLimitInput"]');

    await input.click({ delay: 200 });
    await page.keyboard.type(String(amountPoint), { delay: 200 });
    console.log('✅ Đã nhập giới hạn chi tiêu');
  } catch (error: any) {
    console.log('❌ Lỗi khi nhập giới hạn chi tiêu:', error.message);
  }
  await page.waitForTimeout(1400);
  try {
    const saveButton = page.locator(
      'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6.xlyipyv.xuxw1ft:text("Lưu")',
    );
    await saveButton.click({ delay: 200 });
    console.log('✅ Đã click vào lưu');
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào lưu:', error.message);
  }
  await page.waitForTimeout(15000);
  const successText = page.locator('span', {
    hasText: /^Đã cập nhật giới hạn chi tiêu cho tài khoản$/,
  });

  if (await successText.isVisible({})) {
    console.log('✅ Có Thành công thêm giới hạn chi tiêu');
    result = 1;
  } else {
    console.log('❌ Không có Thành công giới hạn chi tiêu');
  }
  await page.waitForTimeout(10000);
  await browser.close();
  return result;
};

// autoChangeLimitSpend({
//   bm_id: '1183899226256278',
//   ads_account_id: '120227186136080332',
//   amountPoint: 1000000,
// });
