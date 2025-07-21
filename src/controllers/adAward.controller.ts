import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { z } from 'zod';
import { parse } from 'csv-parse';
import { parse as parseDate, isValid } from 'date-fns';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import readline from 'readline';
import axios from 'axios';
import 'dotenv/config';
import { formatISO } from 'date-fns';

function parseDateString(str: string): Date | null {
  const parsed = parseDate(str.trim(), 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : null;
}
async function importLargeCSV(filePath: string) {
  const BATCH_SIZE = 100;
  const buffer: any[] = [];

  const parser = parse({
    delimiter: '\t',
    trim: true,
    skip_empty_lines: true,
    from_line: 3,
  });

  const input = fs.createReadStream(filePath, { encoding: 'utf16le' });

  async function insertOrUpdateBatch(batch: any[]) {
    for (const data of batch) {
      try {
        await prisma.adReward.upsert({
          where: {
            ad_account_id_start_period_end_period: {
              ad_account_id: data.ad_account_id,
              start_period: data.start_period,
              end_period: data.end_period,
            },
          },
          create: data,
          update: {
            ad_account_name: data.ad_account_name,
            minimum_amount_spent: data.minimum_amount_spent,
            qualifying_amount_spent: data.qualifying_amount_spent,
            rewards_earned: data.rewards_earned,
            featured_product: data.featured_product,
            promotion: data.promotion,
            date_of_deposit: data.date_of_deposit,
            updated_at: new Date(),
          },
        });
      } catch (err) {
        console.error('❌ Lỗi khi upsert bản ghi:', data, err);
      }
    }
  }

  parser.on('readable', async () => {
    let row;
    while ((row = parser.read())) {
      if (!row || row.length !== 10) {
        console.warn('⚠️ Dòng không hợp lệ (không đủ 10 cột):', row);
        continue;
      }

      const [
        ad_account_id,
        ad_account_name,
        minimum_amount_spent,
        qualifying_amount_spent,
        rewards_earned,
        featured_product,
        promotion,
        start_period,
        end_period,
        date_of_deposit,
      ] = row;

      buffer.push({
        ad_account_id: ad_account_id.replace(/^'/, ''),
        ad_account_name: ad_account_name.replace(/^'/, ''),
        minimum_amount_spent: parseFloat(
          minimum_amount_spent.replace(/\$/g, '').replace(',', '.'),
        ),
        qualifying_amount_spent: parseFloat(
          qualifying_amount_spent.replace(/\$/g, '').replace(',', '.'),
        ),
        rewards_earned: parseFloat(
          rewards_earned.replace(/\$/g, '').replace(',', '.'),
        ),
        featured_product,
        promotion,
        start_period: parseDateString(start_period),
        end_period: parseDateString(end_period),
        date_of_deposit: parseDateString(date_of_deposit),
      });

      if (buffer.length >= BATCH_SIZE) {
        await insertOrUpdateBatch(buffer);
        buffer.length = 0;
      }
    }
  });

  parser.on('end', async () => {
    if (buffer.length > 0) {
      await insertOrUpdateBatch(buffer);
    }
    console.log('✅ Import hoàn tất!');
  });

  parser.on('error', (err) => {
    console.error('❌ Lỗi parser:', err);
  });

  await pipeline(input, parser);
}

const AdAwardsController = {
  createAdAwards: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        errorResponse(
          res,
          req.t('invalid_data'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      await importLargeCSV(req.file.path);
      fs.unlinkSync(req.file.path);
      successResponse(res, 'success', {});
    } catch (error: any) {
      if (req?.file?.path) {
        fs.unlinkSync(req?.file?.path);
      }
      console.log(error);
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAllAdAwards: async (req: Request, res: Response): Promise<void> => {
    try {
      successResponse(res, 'success', {});
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
};
const getLarkBaseAccessToken = async (): Promise<string> => {
  try {
    if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
      throw new Error(
        'Lark app ID or secret is not set in environment variables',
      );
    }
    const response = await axios.post(
      'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET,
      },
    );

    const { tenant_access_token, code, msg } = response.data;

    if (code !== 0) {
      throw new Error(`Lark token error: ${msg}`);
    }

    return tenant_access_token;
  } catch (error: any) {
    console.error('Error fetching Lark access token:', error.message);
    throw error;
  }
};
const toStringSafe = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) return formatISO(val, { representation: 'date' });
  return val.toString();
};
const fieldMapping = (record: any) => ({
  'ID tài khoản quảng cáo': toStringSafe(record.ad_account_id),
  'Tên tài khoản quảng cáo': toStringSafe(record.ad_account_name),
  'Số tiền tối thiểu để đủ điều kiện': toStringSafe(
    record.minimum_amount_spent,
  ),
  'Số tiền đã chi tiêu đủ điều kiện': toStringSafe(
    record.qualifying_amount_spent,
  ),
  'Phần thưởng đã đạt được': toStringSafe(record.rewards_earned),
  'Sản phẩm đáng chú ý': toStringSafe(record.featured_product),
  'Tên khuyến mãi': toStringSafe(record.promotion),
  'Thời gian bắt đầu': toStringSafe(record.start_period),
  'Thời gian kết thúc': toStringSafe(record.end_period),
  'Ngày thanh toán': toStringSafe(record.date_of_deposit),
});
export const upsertLarkRecord = async (record: any) => {
  const APP_ID = process.env.APP_ID!;
  const TABLE_ID = process.env.TABLE_ID!;
  const ACCESS_TOKEN = record.ACCESS_TOKEN || '';
  const keyFilter = {
    conditions: [
      {
        field_name: 'ID tài khoản quảng cáo',
        operator: 'is',
        value: [record.ad_account_id],
      },
      {
        field_name: 'Thời gian bắt đầu',
        operator: 'is',
        value: [toStringSafe(record.start_period)],
      },
      {
        field_name: 'Thời gian kết thúc',
        operator: 'is',
        value: [toStringSafe(record.end_period)],
      },
    ],
    conjunction: 'and',
  };

  // 1. Kiểm tra record đã tồn tại trên Lark
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
};
export const asyncAdAwards = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ACCESS_TOKEN = await getLarkBaseAccessToken();
    const list = await prisma.adReward.findMany({});
    for (const item of list) {
      await upsertLarkRecord({ ...item, ACCESS_TOKEN });
    }
    successResponse(res, 'Đồng bộ thành công', {});
  } catch (error: any) {
    errorResponse(
      res,
      error?.message,
      error,
      httpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
export default AdAwardsController;
