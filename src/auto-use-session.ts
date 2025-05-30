import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

export const autoChangePartner = async (data: any) => {
  const { bm_id = '', ads_account_id = '725667773735916' } = data;
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
    `https://business.facebook.com/latest/settings/ad_accounts?business_id=1210548737046963&selected_asset_id=${ads_account_id}&selected_asset_type=ad-account`,
  );

  try {
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('❌ Chưa đăng nhập - cần đăng nhập thủ công');
    await page.waitForTimeout(20000);
    await context.storageState({ path: storageStatePath });
    console.log('💾 Đã lưu session mới vào:', storageStatePath);
  } catch {
    console.log('✅ Đã đăng nhập thành công!');
  }
  try {
    const exactSelector =
      'div.x1xqt7ti.x1fvot60.xk50ysn.xxio538.x1heor9g.xuxw1ft.x6ikm8r.x10wlt62.xlyipyv.x1h4wwuj.xeuugli';

    const nameLocator = page.locator(exactSelector, {
      hasText: 'Chỉ định đối tác',
    });

    const count = await nameLocator.count();
    console.log(
      `🔍 Tìm thấy ${count} phần tử chính xác có text 'Chỉ định đối tác'`,
    );

    if (count > 0) {
      await nameLocator.first().scrollIntoViewIfNeeded();
      await nameLocator.first().click();
      console.log('✅ Đã click vào phần tử chính xác');
    } else {
      console.log('⚠️ Không tìm thấy phần tử cần click');
    }
  } catch (err: any) {
    console.log('❌ Lỗi khi click:', err.message);
  }
  try {
    await page
      .locator('input[placeholder="ID đối tác kinh doanh"]')
      .fill(bm_id);
    console.log('✅ Đã nhập ID đối tác kinh doanh');
  } catch (error: any) {
    console.log('❌ Lỗi khi nhập ID đối tác kinh doanh:', error.message);
  }
  try {
    const switchLocator = page.locator(
      'input[aria-label="Quản lý chiến dịch (quảng cáo)"][role="switch"][type="checkbox"]',
    );

    await switchLocator.waitFor({ state: 'visible', timeout: 10000 });
    await switchLocator.click();
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào switch:', error.message);
  }
  try {
    const divSelector =
      'div.x1xqt7ti.x1fvot60.xk50ysn.xxio538.x1heor9g.xuxw1ft.x6ikm8r.x10wlt62.xlyipyv.x1h4wwuj.xeuugli';

    const divLocator = page.locator(divSelector);

    const count = await divLocator.count();
    console.log(`🔍 Tổng số phần tử có class tương ứng: ${count}`);

    let exactIndex = -1;

    for (let i = 0; i < count; i++) {
      const text = (await divLocator.nth(i).textContent())?.trim() ?? '';
      console.log(`🔎 Text phần tử ${i}:`, JSON.stringify(text));

      if (text === 'Chỉ định') {
        exactIndex = i;
        break;
      }
    }

    if (exactIndex >= 0) {
      const exactLocator = divLocator.nth(exactIndex);
      await exactLocator.scrollIntoViewIfNeeded();
      await exactLocator.click({ force: true });
      console.log('✅ Đã click vào div có text chính xác "Chỉ định"');
      result = 1;
    } else {
      console.log('⚠️ Không tìm thấy div có text chính xác "Chỉ định"');
    }
  } catch (error: any) {
    console.log('❌ Lỗi khi click vào div "Chỉ định":', error.message);
  }
  await new Promise(() => {});
  await page.waitForTimeout(10000);
  await browser.close();
  return result;
};
