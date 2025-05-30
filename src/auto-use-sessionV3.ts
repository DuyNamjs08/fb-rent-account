import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

export const autoChangePartner = async () => {
  const browser = await chromium.launch({
    headless: false,
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
    `https://business.facebook.com/billing_hub/accounts/details?asset_id=511278344380577&business_id=1210548737046963&placement=standalone`,
  );
  let List: any = {};
  List = await new Promise((resolve) => {
    let handled = false;

    page.on('request', async (request) => {
      if (handled) return;
      if (
        request.method() === 'POST' &&
        request.url().includes('https://business.facebook.com/api/graphql') // thay bằng endpoint của bạn
      ) {
        handled = true;
        const postData = request.postData();
        const cookies = await page.context().cookies();
        const c_user = cookies.find((item) => item.name === 'c_user')?.value;
        const cookieHeader = cookies
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join('; ');
        if (postData) {
          const params = new URLSearchParams(postData);
          const data = Object.fromEntries(params.entries());
          resolve({
            payload: data,
            cookies: cookieHeader,
            c_user,
          });
        } else {
          resolve({}); // Nếu không có postData
        }
      }
    });
  });
  console.log('payload', List);
  const { payload, cookies, c_user } = List;
  if (payload?.lsd && payload?.fb_dtsg) {
    const response = await page.evaluate(
      async ({ payload, cookies, c_user }) => {
        const headers = {
          cookie: cookies,
          'content-type': 'application/x-www-form-urlencoded',
          'x-fb-friendly-name': 'useBillingRemoveASLMutation',
          'x-fb-lsd': payload?.lsd || 'YRXcmFXLQMOmkLEEwD4FDd',
        };
        console.log('headers', headers);
        const res = await fetch('https://business.facebook.com/api/graphql/', {
          method: 'POST',
          headers: headers,
          body: new URLSearchParams({
            fb_dtsg: payload?.fb_dtsg,
            lsd: payload?.lsd,
            doc_id: '9689753567808836',
            variables: JSON.stringify({
              input: {
                billable_account_payment_legacy_account_id: '511278344380577',
                upl_logging_data: {
                  context: 'billingspendlimits',
                  entry_point: 'BILLING_HUB',
                },
                actor_id: c_user || payload.__user,
                client_mutation_id: '3',
              },
            }),
          }),
          credentials: 'include',
        });

        const result = await res.json();
        return result;
      },
      { payload, cookies, c_user },
    ); // <-- Truyền payload vào đây
    console.log('📦 Kết quả từ API:', response);
  } else {
    console.log('lỗi khi call api');
  }
  await new Promise(() => {});
  await page.waitForTimeout(30000);
  await browser.close();
  return result;
};
autoChangePartner();
