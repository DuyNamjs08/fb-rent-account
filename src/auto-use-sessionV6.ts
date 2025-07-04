import { chromium, BrowserContext, Page } from 'playwright';
import { randomDelay } from './auto-use-session';
import { getFacebookSecurityCodesFromEmail } from './controllers/autoTakeVerify.controller';

export const autoChangeVisa = async (data: any) => {
  const {
    bm_id = '',
    ads_account_id = '',
    cookie_origin,
    visa_name,
    visa_number,
    visa_expiration,
    visa_cvv,
  } = data;
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300, // Tự động chậm lại giữa mỗi thao tác
  });

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
  try {
    await page.goto(
      `https://business.facebook.com/billing_hub/accounts/details?asset_id=${ads_account_id}&business_id=${bm_id}&placement=standalone`,
    );
  } catch (e) {
    console.error('❌ page.goto crashed:', e);
    await browser.close();
  }
  const lang = await page.getAttribute('html', 'lang');

  let response = 0;
  let result = 0;
  if (lang === 'en') {
    console.log('🌐 Ngôn ngữ trang thêm hạn mức:', lang);
    response = await hanleEn({
      page,
      result,
      visa_name,
      visa_number,
      visa_expiration,
      visa_cvv,
    });
  }
  await page.waitForTimeout(10000);
  await browser.close();
  return response;
};
const hanleEn = async ({
  page,
  result,
  visa_name,
  visa_number,
  visa_expiration,
  visa_cvv,
}: {
  page: Page;
  result: number;
  visa_name: string;
  visa_number: string;
  visa_expiration: string;
  visa_cvv: string;
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

  const heading = page.locator('div[role="heading"][aria-level="3"]', {
    hasText: 'Payment methods',
  });
  await heading.scrollIntoViewIfNeeded({ timeout: 400 });
  await page.waitForTimeout(1000);

  try {
    const allSpans = page.locator('span', { hasText: /^Add payment method$/ });
    const count = await allSpans.count();
    console.log(`🔎 Tìm thấy ${count} phần tử Add payment method`);
    if (count > 0) {
      // Click vào tất cả hoặc chỉ phần tử đầu
      await allSpans.nth(0).hover();
      await allSpans.nth(0).click({ delay: 200, force: true });
      console.log('✅ Đã click vào phần tử Add payment method');
    } else {
      console.log(
        `⚠️ Số lượng phần tử Add payment method KHÔNG PHẢI là ${count} , không click.`,
      );
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click vào phần tử:', err.message);
  }

  await page.waitForTimeout(1500);
  try {
    const checkbox = page.locator(
      'input[aria-label="I have an ad credit to claim."]',
    );
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click({ delay: 200 });
    console.log('✅ Đã click vào checkbox');
  } catch (err: any) {
    console.error('❌ Không thể click vào checkbox:', err.message);
  }
  await page.waitForTimeout(1400);
  try {
    const target = page.locator('span', {
      hasText: /^Next$/,
    });
    await target.nth(0).waitFor({ state: 'visible' });
    await target.nth(0).hover();
    await target.nth(0).click({ delay: 200, force: true });
    console.log('✅ Đã click vào nút "Next"');
  } catch (err: any) {
    console.error('❌ Không thể click vào nút "Next":', err.message);
  }

  await page.waitForTimeout(1500);
  try {
    const checkbox = page.locator('input[name="firstName"]');
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    await checkbox.click({ delay: 200 });
    await page.keyboard.type(String(visa_name), { delay: 500 });
    console.log('✅ Đã click vào firstName');
  } catch (err: any) {
    console.error('❌ Không thể click vào firstName:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const checkbox = page.locator('input[name="cardNumber"]');
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    await checkbox.click({ delay: 200 });
    await page.keyboard.type(String(visa_number), { delay: 500 });
    console.log('✅ Đã click vào cardNumber');
  } catch (err: any) {
    console.error('❌ Không thể click vào cardNumber:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const checkbox = page.locator('input[name="expiration"]');
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    await checkbox.click({ delay: 200 });
    await page.keyboard.type(String(visa_expiration), { delay: 500 });
    console.log('✅ Đã click vào expiration');
  } catch (err: any) {
    console.error('❌ Không thể click vào expiration:', err.message);
  }
  await page.waitForTimeout(1500);
  try {
    const checkbox = page.locator('input[name="securityCode"]');
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    await checkbox.click({ delay: 200 });
    await page.keyboard.type(String(visa_cvv), { delay: 500 });
    console.log('✅ Đã click vào securityCode');
  } catch (err: any) {
    console.error('❌ Không thể click vào securityCode:', err.message);
  }
  await page.waitForTimeout(2000);

  try {
    const verify = page.locator('span', {
      hasText: /^Save$/,
    });
    const count = await verify.count();
    console.log(`🔍 Tìm thấy ${count} phần tử chính xác có text 'Save'`);
    if (count >= 0) {
      await page.waitForTimeout(1000 + randomDelay());
      const element = verify.nth(1);
      await element.hover();
      await element.click({ delay: randomDelay(150, 300) });
      console.log('✅ Đã click vào phần tử Save');
    } else {
      console.log('⚠️ Không tìm thấy phần tử Save');
    }
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào Save:', error.message);
  }
  // await new Promise(() => {});
  await page.waitForTimeout(20000);
  const successText = page.locator('span', {
    hasText: 'successfully',
  });
  const countSuccess = await successText.count();
  if (countSuccess > 0) {
    console.log('✅ Có Thành công "successfully"');
    result = 1;
  } else {
    console.log('❌ Không có Thành công "successfully"');
  }
  return result;
};

// autoChangeVisa({
//   visa_name: 'LU DUY NAM',
//   visa_number: '4780 9701 2638 2219',
//   visa_expiration: '11/32',
//   visa_cvv: '542',
//   bm_id: '389076542869829',
//   ads_account_id: '794079162674836',
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
