import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getFacebookSecurityCodesFromEmail } from './controllers/autoTakeVerify.controller';
export function randomDelay(min = 100, max = 500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const autoChangePartner = async (data: any) => {
  const {
    bm_id = '',
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
  try {
    await page.goto(
      `https://business.facebook.com/latest/settings/ad_accounts?business_id=${bm_origin}&selected_asset_id=${ads_account_id}&selected_asset_type=ad-account`,
    );
  } catch (e) {
    console.error('❌ page.goto crashed:', e);
    await browser.close();
  }
  const lang = await page.getAttribute('html', 'lang');

  let response = 0;
  let result = 0;
  if (lang === 'vi') {
    console.log('🌐 Ngôn ngữ trang:', lang);
    response = await hanleVi({
      page,
      ads_name,
      result,
      bm_id,
      ads_account_id,
    });
  } else if (lang === 'en') {
    console.log('🌐 Ngôn ngữ trang:', lang);
    response = await hanleEn({
      page,
      ads_name,
      result,
      bm_id,
      ads_account_id,
    });
  }

  // await new Promise(() => {});
  await page.waitForTimeout(10000);
  await browser.close();
  console.log('response', response);
  return response;
};
const hanleEn = async ({
  page,
  ads_name,
  result,
  bm_id,
  ads_account_id,
}: {
  page: Page;
  ads_name: string;
  result: number;
  bm_id: string;
  ads_account_id: string;
}) => {
  await page.waitForLoadState('networkidle');
  let isVerify = 0;
  try {
    const verify = page.locator('div', {
      hasText: /^Verify account$/,
    });
    const count = await verify.count();

    console.log(
      `🔍 Tìm thấy ${count} phần tử chính xác có text 'Verify account'`,
    );
    if (count > 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.nth(2);
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) }).then(() => {
        isVerify = 1;
      });
      console.log('✅ Đã click vào phần tử Verify account');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Verify account');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }
  await page.waitForTimeout(1500);
  if (isVerify) {
    try {
      const verify = page.locator('div', {
        hasText: /^Send email$/,
      });
      const count = await verify.count();
      console.log(
        `🔍 Tìm thấy ${count} phần tử chính xác có text 'Send email'`,
      );
      if (count >= 0) {
        await page.waitForTimeout(1000 + randomDelay());
        const element = verify.nth(1);
        await element.hover();
        await element.click({ delay: randomDelay(150, 300) });
        console.log('✅ Đã click vào phần tử Send email');
      } else {
        console.log('⚠️ Không tìm thấy phần tử Send email');
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
        hasText: /^Submit$/,
      });
      const count = await verify.count();
      console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Submit'`);
      if (count >= 0) {
        await page.waitForTimeout(1000 + randomDelay());
        const element = verify.nth(1);
        await element.hover();
        await element.click({ delay: randomDelay(150, 300) });
        console.log('✅ Đã click vào phần tử Submit');
      } else {
        console.log('⚠️ Không tìm thấy phần tử Submit');
      }
    } catch (err: any) {
      console.log('❌ Lỗi khi click Submit:', err.message);
    }
    await page.waitForTimeout(6000);
    try {
      const verify = page.locator('div', {
        hasText: /^Done$/,
      });
      const count = await verify.count();
      console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Done'`);
      if (count >= 0) {
        await page.waitForTimeout(1000 + randomDelay());
        const element = verify.nth(2);
        await element.hover();
        await element.click({ delay: randomDelay(150, 300) });
        console.log('✅ Đã click vào phần tử Done');
      } else {
        console.log('⚠️ Không tìm thấy phần tử Done');
      }
    } catch (err: any) {
      console.log('❌ Lỗi khi click Done:', err.message);
    }
  }

  await page.waitForTimeout(1500);
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(2000);

  try {
    const input = await page.locator(
      'input[placeholder="Search by name or ID"]',
    );
    await input.first().click();
    await page.keyboard.type(ads_account_id, { delay: 500 });
    console.log('✅ Đã nhập Search by name or ID');
  } catch (error: any) {
    console.log('❌ Lỗi khi nhập Search by name or ID:', error.message);
  }
  await page.waitForTimeout(2000);
  // await new Promise(() => {});
  try {
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
  await page.waitForTimeout(2000);

  try {
    const nameLocator = page.locator('div', {
      hasText: /^Assign partner$/,
    });
    const count = await nameLocator.count();
    console.log(
      `🔍 Tìm thấy ${count} phần tử chính xác có text 'Assign partner'`,
    );

    if (count > 0) {
      await nameLocator.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      await nameLocator.first().click({ delay: 200 });
      console.log('✅ Đã click vào phần tử Assign partner');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Assign partner');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }

  await page.waitForTimeout(1500);

  try {
    const input = await page.locator(
      'input[placeholder="Partner Business ID"]',
    );
    await input.click();
    await page.keyboard.type(bm_id, { delay: 100 });
    console.log('✅ Đã nhập Partner Business ID');
  } catch (error: any) {
    console.log('❌ Lỗi khi nhập Partner Business ID:', error.message);
  }

  await page.waitForTimeout(1200);

  try {
    const switchLocator = page.locator(
      'input[aria-label="Manage ad accounts"][role="switch"][type="checkbox"]',
    );

    await switchLocator.waitFor({ state: 'visible', timeout: 10000 });
    await switchLocator.click({ delay: 200 });
    console.log('✅ Đã bật quyền Manage ad accounts');
  } catch (error: any) {
    console.log('❌ Không bật được quyền Manage ad accounts:', error.message);
  }

  try {
    const verify = page.locator('div', {
      hasText: /^Assign$/,
    });
    const count = await verify.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Assign'`);
    if (count >= 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.nth(2);
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) });
      console.log('✅ Đã click vào phần tử Assign');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Assign');
    }
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào Assign:', error.message);
  }
  try {
    await page.waitForSelector(
      'div[role="heading"][aria-level="3"]:has-text("Partner Added")',
      { timeout: 30000 },
    );
    console.log('✅ Partner Added thành công!');
    result = 1;
  } catch {
    console.log('⚠️ Không thấy thông báo "Partner Added" sau 30 giây.');
  }
  return result;
};
const hanleVi = async ({
  page,
  ads_name,
  result,
  bm_id,
  ads_account_id,
}: {
  page: Page;
  ads_name: string;
  result: number;
  bm_id: string;
  ads_account_id: string;
}) => {
  await page.waitForLoadState('networkidle');
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

  await page.waitForTimeout(1500);
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 400);

  await page.waitForTimeout(2000);

  try {
    const input = await page.locator(
      'input[placeholder="Tìm kiếm theo tên hoặc ID"]',
    );
    await input.first().click();
    await page.keyboard.type(ads_account_id, { delay: 500 });
    console.log('✅ Đã nhập Tìm kiếm theo tên hoặc ID');
  } catch (error: any) {
    console.log('❌ Lỗi khi nhập Tìm kiếm theo tên hoặc ID:', error.message);
  }
  await page.waitForTimeout(2000);

  try {
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
  await page.waitForTimeout(2000);

  try {
    const nameLocator = page.locator('div', {
      hasText: /^Chỉ định đối tác$/,
    });
    const count = await nameLocator.count();
    console.log(
      `🔍 Tìm thấy ${count} phần tử chính xác có text 'Chỉ định đối tác'`,
    );

    if (count > 0) {
      await nameLocator.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      await nameLocator.first().click({ delay: 200 });
      console.log('✅ Đã click vào phần tử chính xác');
    } else {
      console.log('⚠️ Không tìm thấy phần tử cần click');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }

  await page.waitForTimeout(1500);

  try {
    const input = await page.locator(
      'input[placeholder="ID đối tác kinh doanh"]',
    );
    await input.click();
    await page.keyboard.type(bm_id, { delay: 400 });
    console.log('✅ Đã nhập ID đối tác kinh doanh');
  } catch (error: any) {
    console.log('❌ Lỗi khi nhập ID đối tác kinh doanh:', error.message);
  }

  await page.waitForTimeout(1200);

  try {
    const switchLocator = page.locator(
      'input[aria-label="Quản lý chiến dịch (quảng cáo)"][role="switch"][type="checkbox"]',
    );

    await switchLocator.waitFor({ state: 'visible', timeout: 10000 });
    await switchLocator.click({ delay: 500 });
    console.log('✅ Đã bật quyền quản lý chiến dịch');
  } catch (error: any) {
    console.log('❌ Không bật được quyền:', error.message);
  }

  try {
    const verify = page.locator('div', {
      hasText: /^Chỉ định$/,
    });
    const count = await verify.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Chỉ định'`);
    if (count >= 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.nth(2);
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) });
      console.log('✅ Đã click vào phần tử Chỉ định');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Chỉ định');
    }
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào Chỉ định:', error.message);
  }
  try {
    await page.waitForSelector(
      'div[role="heading"][aria-level="3"]:has-text("Đã thêm đối tác")',
      { timeout: 30000 },
    );
    console.log('✅ Đã thêm đối tác thành công!');
    result = 1;
  } catch {
    console.log('⚠️ Không thấy thông báo "Đã thêm đối tác" sau 30 giây.');
  }
  return result;
};

// autoChangePartner({
//   bm_origin: '9906754416026994',
//   ads_name: 'NHẬM LUXURY 13',
//   bm_id: '1015722189158178',
//   ads_account_id: '794079162674836',
//   cookie_origin: {
//     cookies: [
//       {
//         name: 'datr',
//         value: 'xjyEaLy_Pe8Hjeh6mv8AGR0W',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1788056774.799506,
//         httpOnly: true,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'sb',
//         value: 'xjyEaPC3J9WwLihSO1spXMOO',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1788057137.452273,
//         httpOnly: true,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'wd',
//         value: '1280x800',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1754101945,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'Lax',
//       },
//       {
//         name: 'dpr',
//         value: '1',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1754101945,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: '_cfuvid',
//         value:
//           '2Tcy_EqLJ0qhYnviOGCTm_1P9sZBMu9.hAx5FSqz2z4-1717104076479-0.0.1.1-604800000',
//         domain: '.arkoselabs.com',
//         path: '/',
//         expires: -1,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'ps_l',
//         value: '1',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1788057045.727695,
//         httpOnly: true,
//         secure: true,
//         sameSite: 'Lax',
//       },
//       {
//         name: 'ps_n',
//         value: '1',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1788057045.727745,
//         httpOnly: true,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'timestamp',
//         value: '175349700110065',
//         domain: 'meta-api.arkoselabs.com',
//         path: '/',
//         expires: -1,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'locale',
//         value: 'vi_VN',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1754101919.128821,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'c_user',
//         value: '61565024309842',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1785033137.452132,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'xs',
//         value: '7%3A2ItlJwTzpcgmrA%3A2%3A1753497134%3A-1%3A-1',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1785033137.452309,
//         httpOnly: true,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'fr',
//         value:
//           '01fIsXXiaQ0eixoMo.AWdhjEphcysEpfg65Dnfa13NHu5BbTR7TVXekVlCS6r2CVvaskQ.BohDzG..AAA.0.0.BohD43.AWfThvfivyC1c5heqABysoL9Fbc',
//         domain: '.facebook.com',
//         path: '/',
//         expires: 1761273143.151009,
//         httpOnly: true,
//         secure: true,
//         sameSite: 'None',
//       },
//       {
//         name: 'presence',
//         value:
//           'C%7B%22t3%22%3A%5B%5D%2C%22utc3%22%3A1753497145800%2C%22v%22%3A1%7D',
//         domain: '.facebook.com',
//         path: '/',
//         expires: -1,
//         httpOnly: false,
//         secure: true,
//         sameSite: 'Lax',
//       },
//     ],
//     origins: [],
//   },
// });
