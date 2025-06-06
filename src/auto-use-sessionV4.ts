import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { randomDelay } from './auto-use-session';
import { getFacebookSecurityCodesFromEmail } from './controllers/autoTakeVerify.controller';

export const autoRemovePartner = async (data: any) => {
  const { ads_account_id = '', bm_origin = '', ads_name = '' } = data;
  const browser = await chromium.launch({
    headless: false,
    // proxy: {
    //   server: 'http://proxy.example.com:8000',
    //   username: 'proxy_user',
    //   password: 'proxy_pass',
    // },
    slowMo: 100, // Tự động chậm lại giữa mỗi thao tác
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
    `https://business.facebook.com/latest/settings/ad_accounts?business_id=${bm_origin}&selected_asset_id=${ads_account_id}&selected_asset_type=ad-account`,
  );
  await page.waitForLoadState('networkidle');
  // phần xác minh tài khoản
  let isVerify = 0;
  try {
    const verify = page.locator('div', {
      hasText: /^Xác minh tài khoản$/,
    });
    const count = await verify.count();

    console.log(
      `🔍 Tìm thấy ${count} phần tử chính xác có text 'Xác minh tài khoản'`,
    );
    if (count > 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.nth(2);
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) }).then(() => {
        isVerify = 1;
      });
      console.log('✅ Đã click vào phần tử Xác minh tài khoản');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Xác minh tài khoản');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }
  await page.waitForTimeout(1500);
  if (isVerify) {
    try {
      const verify = page.locator('div', {
        hasText: /^Gửi email$/,
      });
      const count = await verify.count();
      console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Gửi email'`);
      if (count >= 0) {
        await page.waitForTimeout(1000 + randomDelay());
        const element = verify.nth(1);
        await element.hover();
        await element.click({ delay: randomDelay(150, 300) });
        console.log('✅ Đã click vào phần tử Gửi email');
      } else {
        console.log('⚠️ Không tìm thấy phần tử Gửi email');
      }
    } catch (err: any) {
      console.log('❌ Lỗi khi click:', err.message);
    }
    await page.waitForTimeout(30000);
    const verifyCode = await getFacebookSecurityCodesFromEmail({ email: '' });
    console.log('verifyCode', verifyCode);
    const codeToEnter = verifyCode.at(-1) ?? '';
    try {
      const input = await page.locator('input[placeholder="123456"]');
      await input.click();
      for (const char of codeToEnter) {
        await page.keyboard.type(char, { delay: randomDelay(80, 150) });
      }
      console.log('✅ Đã nhập mã verifyCode.at(-1)', verifyCode.at(-1));
    } catch (error: any) {
      console.log('❌ Lỗi khi nhập verifyCode.at(-1):', error.message);
    }

    try {
      const verify = page.locator('div', {
        hasText: /^Gửi$/,
      });
      const count = await verify.count();
      console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Gửi'`);
      if (count >= 0) {
        await page.waitForTimeout(1000 + randomDelay());
        const element = verify.nth(1);
        await element.hover();
        await element.click({ delay: randomDelay(150, 300) });
        console.log('✅ Đã click vào phần tử Gửi');
      } else {
        console.log('⚠️ Không tìm thấy phần tử Gửi');
      }
    } catch (err: any) {
      console.log('❌ Lỗi khi click Gửi:', err.message);
    }
    await page.waitForTimeout(6000);
    try {
      const verify = page.locator('div', {
        hasText: /^Xong$/,
      });
      const count = await verify.count();
      console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Xong'`);
      if (count >= 0) {
        await page.waitForTimeout(1000 + randomDelay());
        const element = verify.nth(1);
        await element.hover();
        await element.click({ delay: randomDelay(150, 300) });
        console.log('✅ Đã click vào phần tử Xong');
      } else {
        console.log('⚠️ Không tìm thấy phần tử Xong');
      }
    } catch (err: any) {
      console.log('❌ Lỗi khi click Xong:', err.message);
    }
  }
  // phần xác minh tài khoản
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
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1000);

  try {
    const bmLocator = page.locator(
      `div[role="heading"][aria-level="4"].x1xqt7ti.xsuwoey.x63nzvj.xbsr9hj.xuxw1ft.x6ikm8r.x10wlt62.xlyipyv.x1h4wwuj.x1fcty0u.xeuugli:has-text("${ads_name}")`,
    );

    await bmLocator.waitFor({ state: 'visible', timeout: 10000 });
    await bmLocator.click({ delay: 200 });
    console.log(`✅ Đã click vào BM "${ads_name}"`);
  } catch (error: any) {
    console.log(
      `❌ Không tìm thấy hoặc không click được ${ads_name}:`,
      error.message,
    );
  }
  await page.waitForTimeout(1200);
  try {
    const nameLocator = page.locator('span', {
      hasText: /^Đối tác$/,
    });
    const count = await nameLocator.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'đối tác'`);

    if (count >= 4) {
      await page.waitForTimeout(1200);
      await nameLocator.nth(1).click({ delay: 200 });
      console.log('✅ Đã click vào phần tử đối tác');
    } else {
      console.log('⚠️ Không tìm thấy phần tử đối tác');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const nameLocator = page.locator('div', {
      hasText: /^Quản lý$/,
    });
    const count = await nameLocator.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Quản lý'`);

    if (count >= 4) {
      await page.waitForTimeout(1200);
      await nameLocator.nth(1).click({ delay: 200 });
      console.log('✅ Đã click vào phần tử Quản lý');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Quản lý');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const nameLocator = page.locator('div', {
      hasText: /^Gỡ quyền truy cập$/,
    });
    const count = await nameLocator.count();
    console.log(
      `🔍 Tìm thấy ${count} phần tử chính xác có text 'Gỡ quyền truy cập'`,
    );

    if (count >= 0) {
      await page.waitForTimeout(1200);
      await nameLocator.nth(2).click({ delay: 200 });
      console.log('✅ Đã click vào phần tử Gỡ quyền truy cập');
      result = 1;
    } else {
      console.log('⚠️ Không tìm thấy phần tử Gỡ quyền truy cập');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }

  await page.waitForTimeout(10000);
  await browser.close();
  return result;
};

// autoRemovePartner({
//   ads_account_id: '1360591371901484',
//   ads_name: 'BM-LN2',
//   bm_origin: '1043878897701771',
// });
