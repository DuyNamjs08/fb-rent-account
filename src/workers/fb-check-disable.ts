import Bull, { Job } from 'bull';
import prisma from '../config/prisma';
import 'dotenv/config';
import { decryptToken } from '../controllers/facebookBm.controller';
import axios from 'axios';
import { mapItemToAdsAccount } from '../controllers/adAccount.controller';
import { formatISO } from 'date-fns';
import { getLarkBaseAccessToken } from '../controllers/adAward.controller';

export const fbRealtimeCheckDisable = new Bull('fbCheckDisable', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
  },
  limiter: {
    max: 50, // tối đa 50 job
    duration: 1000, // mỗi 1000ms
  },
});
const toStringSafe = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) return formatISO(val, { representation: 'date' });
  return val.toString();
};
const fieldMapping = (record: any) => ({
  'TÊN TKQC': toStringSafe(record.name),
  'ID TKQC': toStringSafe(record.account_id),
  'TÌNH TRẠNG TK': toStringSafe(record.account_status),
});
export const upsertLarkRecord = async (record: any) => {
  const APP_ID = process.env.APP_ID_DSB!;
  const TABLE_ID = process.env.TABLE_ID_DSB!;
  const ACCESS_TOKEN = record.ACCESS_TOKEN || '';
  const keyFilter = {
    conditions: [
      // {
      //   field_name: 'TÊN TKQC',
      //   operator: 'is',
      //   value: [record.name],
      // },
      {
        field_name: 'ID TKQC',
        operator: 'is',
        value: [record.account_id],
      },
      // {
      //   field_name: 'TÌNH TRẠNG TK',
      //   operator: 'is',
      //   value: [record.account_status],
      // },
    ],
    conjunction: 'and',
  };

  // 1. Kiểm tra record đã tồn tại trên Lark
  try {
    const searchResp = await axios.post(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${APP_ID}/tables/${TABLE_ID}/records/search`,
      { filter: keyFilter, page_size: 1 },
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
    );

    const fields = fieldMapping(record);
    const existed = searchResp.data?.data?.items?.[0];
    if (existed) {
      console.log(1);
      // 2. Nếu có → update
      const res = await axios.put(
        `https://open.larksuite.com/open-apis/bitable/v1/apps/${APP_ID}/tables/${TABLE_ID}/records/${existed.record_id}`,
        { fields },
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      );
    } else {
      console.log(2);
      // 3. Nếu chưa có → tạo mới
      const res = await axios.post(
        `https://open.larksuite.com/open-apis/bitable/v1/apps/${APP_ID}/tables/${TABLE_ID}/records`,
        { fields },
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      );
    }
  } catch (error) {
    throw error;
  }
};
const updateDb = async (data: any) => {
  try {
    const systemUserToken = await prisma.facebookBM.findUnique({
      where: {
        bm_id: '1571278653620894',
      },
    });
    if (!systemUserToken) {
      throw new Error('Không tìm thấy system user token');
    }
    const systemUserDecode = await decryptToken(
      systemUserToken.system_user_token,
    );
    if (!systemUserDecode) {
      throw new Error('Giải mã system user token thất bại');
    }
    let totalCount = 0;
    let totalCountV2 = 0;
    let afterCursor = '';
    let afterCursorV2 = '';
    const baseUrl = `https://graph.facebook.com/v17.0/${systemUserToken.bm_id}/owned_ad_accounts`;
    const baseUrlV2 = `https://graph.facebook.com/v17.0/${systemUserToken.bm_id}/client_ad_accounts`;
    const fields = [
      'name',
      'account_id',
      'account_status',
      'users',
      'balance',
      'currency',
      // 'capabilities',
      'business_city',
      'business_country_code',
      'business_name',
      'business_state',
      'business_street',
      'business_street2',
      'business_zip',
      'can_create_brand_lift_study',
      'created_time',
      'custom_audience_info',
      'brand_safety_content_filter_levels',
      'user_tasks',
      'owner',
      'partner',
      'business',
      'amount_spent',
      'agency_client_declaration',
      'spend_cap',
      'min_campaign_group_spend_cap',
      'min_daily_budget',
      'disable_reason',
      'timezone_name',
      'timezone_offset_hours_utc',
      'is_personal',
      'is_prepay_account',
      'tax_id',
      'tax_id_status',
      'account_controls',
      'age',
      'attribution_spec',
      'default_dsa_beneficiary',
      'default_dsa_payor',
      'end_advertiser',
      'end_advertiser_name',
      'existing_customers',
      'expired_funding_source_details',
      'extended_credit_invoice_group',
      'fb_entity',
      'media_agency',
      'funding_source',
      'funding_source_details',
      'has_migrated_permissions',
      'io_number',
      'is_attribution_spec_system_default',
      'is_direct_deals_enabled',
      'is_in_3ds_authorization_enabled_market',
      'is_notifications_enabled',
      'line_numbers',
      'offsite_pixels_tos_accepted',
      'tos_accepted',
      'user_tos_accepted',
    ].join(',');
    let hasNextPage = true;
    let hasNextPageV2 = true;

    while (hasNextPage) {
      let url = `${baseUrl}?fields=${fields}&limit=20&access_token=${systemUserDecode}`;
      if (afterCursor) {
        url += `&after=${afterCursor}`;
      }
      const listdata = await axios.get(url);
      if (listdata.status !== 200) {
        throw new Error(`Lỗi API FB - status: ${listdata.status}`);
      }
      const arrayResult = listdata.data.data;
      if (Array.isArray(arrayResult)) {
        try {
          await Promise.all(
            arrayResult.map((item: any) =>
              prisma.adsAccount.upsert({
                where: { id: item.id },
                update: mapItemToAdsAccount(item),
                create: mapItemToAdsAccount(item),
              }),
            ),
          );
        } catch (err: any) {
          console.error('Failed to post to server:', err.message);
        }
        totalCount += arrayResult.length;
      }
      afterCursor = listdata.data.paging?.cursors?.after || '';
      hasNextPage = !!afterCursor;
      console.log('Next cursor >>>', afterCursor);
    }
    while (hasNextPageV2) {
      try {
        let url = `${baseUrlV2}?fields=${fields}&limit=20&access_token=${systemUserDecode}`;
        if (afterCursorV2) {
          url += `&after=${afterCursorV2}`;
        }

        const listdata = await axios.get(url);

        if (listdata.status !== 200) {
          console.error(`Lỗi API FB (V2) - status: ${listdata.status}`);
          break; // dừng vòng lặp
        }

        const arrayResult = listdata.data.data;
        if (Array.isArray(arrayResult)) {
          try {
            await Promise.all(
              arrayResult.map((item: any) =>
                prisma.adsAccount.upsert({
                  where: { id: item.id },
                  update: mapItemToAdsAccount(item),
                  create: mapItemToAdsAccount(item),
                }),
              ),
            );
          } catch (err: any) {
            console.error('Failed to post to server:', err.message);
          }
          totalCountV2 += arrayResult.length;
        }

        afterCursorV2 = listdata.data.paging?.cursors?.after || '';
        hasNextPageV2 = !!afterCursorV2;
        console.log('Next cursor >>>', afterCursorV2);
      } catch (err: any) {
        console.error(`Lỗi khi gọi API FB (V2): ${err.message}`);
        break; // dừng vòng lặp luôn nếu API bị lỗi
      }
    }

    console.log('Total synced:', totalCount, totalCountV2);
    const listAds = await prisma.adsAccount.findMany({
      // where: {
      //   account_status: {
      //     not: 1,
      //   },
      // },
    });
    console.log('listAds');
    const ACCESS_TOKEN = await getLarkBaseAccessToken();
    for (const item of listAds) {
      await upsertLarkRecord({ ...item, ACCESS_TOKEN });
    }
  } catch (error) {
    console.error('❌ Lỗi khi check disable:', error);
    throw error;
  }
};
fbRealtimeCheckDisable.process(1, async (job) => {
  const { data } = job;
  try {
    console.log('data check', data);
    const res = await updateDb(data);
    return 1;
  } catch (err) {
    console.error(`❌ Lỗi khi check disable`, err);

    throw err;
  }
});
const retryJob = async (job: Job, maxRetry = 3, delayMs = 10 * 60 * 1000) => {
  const data = {
    ...job.data,
    retryCount: (job.data.retryCount || 0) + 1,
  };

  await job.remove();

  if (data.retryCount > maxRetry) {
    console.error(`❌ Job vượt quá số lần retry (${maxRetry}):`, data);
    return;
  }

  await fbRealtimeCheckDisable.add(data, {
    delay: delayMs,
    attempts: 3,
  });
};
