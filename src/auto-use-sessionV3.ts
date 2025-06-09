import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { randomDelay } from './auto-use-session';
import { getFacebookSecurityCodesFromEmail } from './controllers/autoTakeVerify.controller';

export const autoDisChardLimitSpend = async (data: any) => {
  const { bm_id = '', ads_account_id = '', cookie_origin } = data;
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
  // const oldCookiesPath = path.resolve(__dirname, '../fb-cookies.json');
  // const storageStatePath = path.resolve(
  //   __dirname,
  //   '../fb-cookies-browser.json',
  // );
  // if (fs.existsSync(oldCookiesPath) && !fs.existsSync(storageStatePath)) {
  //   console.log('⚙️ Đang chuyển đổi cookie cũ sang định dạng Playwright...');
  //   const rawCookies = JSON.parse(fs.readFileSync(oldCookiesPath, 'utf-8'));
  //   const storageState = {
  //     cookies: rawCookies,
  //     origins: [],
  //   };
  //   fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  //   console.log('✅ Đã tạo file storageState:', storageStatePath);
  // }
  let context: BrowserContext;
  if (cookie_origin) {
    console.log('✅ Tìm thấy file cookies, đang load...');
    try {
      context = await browser.newContext({
        storageState: cookie_origin,
        viewport: { width: 1600, height: 800 },
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
        const element = verify.nth(2);
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

  await page.waitForTimeout(1500);
  const heading = page.locator('div[role="heading"][aria-level="3"]', {
    hasText: 'Hoạt động thanh toán',
  });
  await heading.scrollIntoViewIfNeeded({ timeout: 400 });
  await page.waitForTimeout(1000);

  try {
    const allSpans = page.locator(
      'span.x8t9es0.x1fvot60.xxio538.x1heor9g.xq9mrsl.x1h4wwuj.x1pd3egz.xeuugli.xh8yej3',
    );
    const count = await allSpans.count();
    console.log(`🔎 Tìm thấy ${count} phần tử.`);
    if (count == 19) {
      // Click vào tất cả hoặc chỉ phần tử đầu
      await allSpans.nth(17).scrollIntoViewIfNeeded();
      await allSpans.nth(17).click({ delay: 200, force: true });
      console.log(
        '✅ Đã click vào phần tử đầu tiên trong danh sách 17 phần tử.',
      );
    } else if (count == 16) {
      await allSpans.nth(14).scrollIntoViewIfNeeded();
      await allSpans.nth(14).click({ delay: 200, force: true });
      console.log(
        '✅ Đã click vào phần tử đầu tiên trong danh sách 14 phần tử.',
      );
    } else {
      console.log(`⚠️ Số lượng phần tử KHÔNG PHẢI là ${count} , không click.`);
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click vào phần tử:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const button = page.locator('span', { hasText: /^Gỡ$/ });
    await button.waitFor({ state: 'visible', timeout: 5000 });
    await button.scrollIntoViewIfNeeded();
    await button.click({ delay: 200 });
    console.log('✅ Đã click vào nút "Gỡ"');
  } catch (err: any) {
    console.error('❌ Không thể click vào nút "Gỡ":', err.message);
  }
  await page.waitForTimeout(1200);
  try {
    const verify = page.locator('span', {
      hasText: /^Xóa$/,
    });
    const count = await verify.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Xóa'`);
    if (count >= 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.nth(1);
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) });
      console.log('✅ Đã click vào phần tử Xóa');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Xóa');
    }
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào xóa:', error.message);
  }
  await page.waitForTimeout(15000);
  const successText = page.locator('span', {
    hasText: /^Đã gỡ giới hạn chi tiêu cho tài khoản$/,
  });
  if (await successText.isVisible({})) {
    console.log('✅ Có Thành công gỡ giới hạn');
    result = 1;
  } else {
    console.log('❌ Không có Thành công gỡ giới hạn');
  }
  // await new Promise(() => {});
  await page.waitForTimeout(10000);
  await browser.close();
  return result;
};

// autoDisChardLimitSpend({
//   bm_id: '1043878897701771',
//   ads_account_id: '1360591371901484',
// });
