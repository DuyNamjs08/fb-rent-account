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

  getAllAdAwardss: async (req: Request, res: Response): Promise<void> => {
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

export default AdAwardsController;
