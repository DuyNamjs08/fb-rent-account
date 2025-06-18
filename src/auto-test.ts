import { chromium, BrowserContext } from 'playwright';
export function randomDelay(min = 100, max = 500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const autoTest = async (data: any) => {
  const { cookie_origin } = data;
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

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
      `https://business.facebook.com/latest/settings/ad_accounts?business_id=1043878897701771`,
    );
  } catch (e) {
    console.error('❌ page.goto crashed:', e);
    await browser.close();
  }
  const lang = await page.getAttribute('html', 'lang');

  let response = 0;
  console.log('🌐 Ngôn ngữ trang:', lang);

  // await new Promise(() => {});
  await page.waitForTimeout(10000);
  await browser.close();
  return response;
};

// autoTest({
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
