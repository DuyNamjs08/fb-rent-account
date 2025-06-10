import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { randomDelay } from './auto-use-session';
import { getFacebookSecurityCodesFromEmail } from './controllers/autoTakeVerify.controller';

export const autoRemovePartner = async (data: any) => {
  const {
    ads_account_id = '',
    bm_origin = '',
    ads_name = '',
    cookie_origin,
  } = data;
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
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1000);

  try {
    // const verify = page.locator('div[role="heading"][aria-level="4"]', {
    //   hasText: ads_name,
    // });
    const verify = page.locator(`div[role="heading"]:has-text("${ads_name}")`);
    const count = await verify.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text ${ads_name}`);
    if (count >= 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.first();
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) });
      console.log(`✅ Đã click vào phần tử ${ads_name}`);
    } else {
      console.log(`⚠️ Không tìm thấy phần tử ${ads_name}`);
    }
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào ${ads_name}:', error.message);
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
//   cookie_origin: {
//     cookies: [
//       {
//         name: 'dbln',
//         path: '/login/device-based/',
//         value: '%7B%2261565024309842%22%3A%22cLXW8Tvg%22%7D',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1757041467.106259,
//         httpOnly: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'datr',
//         path: '/',
//         value: 'X6tDaPcZe0M7BWr8XXqOMV-W',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1783825247.250183,
//         httpOnly: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'sb',
//         path: '/',
//         value: 'X6tDaM_uGIPJArI1puFsa68C',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1783825455.415868,
//         httpOnly: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'wd',
//         path: '/',
//         value: '1280x800',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1749870271,
//         httpOnly: false,
//         sameSite: 'Lax',
//       },
//       {
//         name: 'dpr',
//         path: '/',
//         value: '1',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1749870271,
//         httpOnly: false,
//         sameSite: 'None',
//       },
//       {
//         name: '_cfuvid',
//         path: '/',
//         value:
//           '2Tcy_EqLJ0qhYnviOGCTm_1P9sZBMu9.hAx5FSqz2z4-1717104076479-0.0.1.1-604800000',
//         domain: '.arkoselabs.com',
//         secure: true,
//         expires: -1,
//         httpOnly: false,
//         sameSite: 'None',
//       },
//       {
//         name: 'timestamp',
//         path: '/',
//         value: '174926500383964',
//         domain: 'meta-api.arkoselabs.com',
//         secure: true,
//         expires: -1,
//         httpOnly: false,
//         sameSite: 'None',
//       },
//       {
//         name: 'locale',
//         path: '/',
//         value: 'vi_VN',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1749870193.154259,
//         httpOnly: false,
//         sameSite: 'None',
//       },
//       {
//         name: 'c_user',
//         path: '/',
//         value: '61565024309842',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1780801455.415751,
//         httpOnly: false,
//         sameSite: 'None',
//       },
//       {
//         name: 'xs',
//         path: '/',
//         value: '5%3AVNhw4j7VU7AGLg%3A2%3A1749265453%3A-1%3A-1',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1780801455.415895,
//         httpOnly: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'ps_l',
//         path: '/',
//         value: '1',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1783825456.392564,
//         httpOnly: true,
//         sameSite: 'Lax',
//       },
//       {
//         name: 'ps_n',
//         path: '/',
//         value: '1',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1783825456.392609,
//         httpOnly: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'fr',
//         path: '/',
//         value:
//           '0KnrpKKTzrhtVLePZ.AWcI27BjwW-5AgWdC9_YpheFMa9ESbYS-PZQbDTgdRZDfL0YIkA.BoQ6tf..AAA.0.0.BoQ6w9.AWf_xRMKwNy4uvqxKmGcb_raDdE',
//         domain: '.facebook.com',
//         secure: true,
//         expires: 1757041469.614633,
//         httpOnly: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'presence',
//         path: '/',
//         value:
//           'C%7B%22t3%22%3A%5B%5D%2C%22utc3%22%3A1749265471842%2C%22v%22%3A1%7D',
//         domain: '.facebook.com',
//         secure: true,
//         expires: -1,
//         httpOnly: false,
//         sameSite: 'Lax',
//       },
//     ],
//     origins: [],
//   },
// });
