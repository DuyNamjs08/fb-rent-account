import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import 'dotenv/config';
import prisma from '../config/prisma';
import { z } from 'zod';
import axios from 'axios';
import { generateShortCode } from './user.controller';
import { fbRealtimeTransaction } from '../workers/fb-realtime-transaction';
const rechargeSchema = z.object({
  amount: z.preprocess(
    (val) => Number(val),
    z.number().positive('Số tiền phải lớn hơn 0'),
  ),
  user_id: z.string().min(1, 'user_id is required'),
});
async function generateAccessToken() {
  const response = await axios({
    method: 'post',
    url: process.env.PAYPAL_BASE_URL + '/v1/oauth2/token',
    data: 'grant_type=client_credentials',
    auth: {
      username: process.env.PAYPAL_CLIENT_ID || '',
      password: process.env.PAYPAL_SECRET || '',
    },
  });

  return response.data.access_token;
}
async function createPaypalOrder({ amount, id }: any) {
  const accessToken = await generateAccessToken();
  const response = await axios.post(
    `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amount,
          },
          custom_id: id || '',
        },
      ],
      application_context: {
        return_url: 'https://aka-ads.duynam.store/paypal-verify',
        cancel_url: 'https://aka-ads.duynam.store/paypal-verify',
        // return_url:
        //   'https://ashley-immigrants-closed-alpine.trycloudflare.com/paypal-verify',
        // cancel_url:
        //   'https://ashley-immigrants-closed-alpine.trycloudflare.com/paypal-verify',

        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return response.data;
}

const paypalController = {
  createPaypalWebhook: async (req: Request, res: Response): Promise<void> => {
    try {
      const event = req.body;

      console.log('Webhook event:', event);
      console.log('Customer Id:', event?.resource?.custom_id);

      // Xử lý theo loại event
      if (
        event.event_type === 'PAYMENT.CAPTURE.COMPLETED' &&
        event?.resource?.custom_id
      ) {
        const id = event?.resource?.custom_id;
        const amount = event.resource.amount.value;
        const currency = event.resource.amount.currency_code;
        const transactionId = event.resource.id;
        const payerEmail = event.resource.payer?.email_address;
        const paypalFee =
          event.resource.seller_receivable_breakdown?.paypal_fee.value;
        const netAmount =
          event.resource.seller_receivable_breakdown?.net_amount.value;

        console.log('🟢 Payment completed:', {
          transactionId,
          amount,
          currency,
          paypalFee,
          netAmount,
          payerEmail,
        });
        const transaction = await prisma.transaction.findUnique({
          where: {
            id: id,
          },
        });
        const jobData = {
          short_code: transaction?.short_code,
          amountVND: 0,
          usd: Number(amount),
          net_usd: Number(netAmount),
          transactionID: 1,
          description: '',
          bank: 'visa',
          type: 'in',
          date: new Date(),
        };
        await fbRealtimeTransaction.add(jobData, {
          removeOnComplete: true,
          removeOnFail: true,
        });
      }

      res.sendStatus(200);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  paypalOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, user_id } = req.body;
      const parsed = rechargeSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          req.t('invalid_data'),
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      let shortCode: string = '';
      let isUnique = false;
      while (!isUnique) {
        shortCode = generateShortCode();
        const existingUser = await prisma.transaction.findUnique({
          where: { short_code: shortCode },
        });
        if (!existingUser) isUnique = true;
      }
      const amountVNDchange = Math.floor(Number(amount));
      const transaction = await prisma.transaction.create({
        data: {
          short_code: shortCode,
          amountVND: amountVNDchange,
          points: amountVNDchange,
          transactionID: 0,
          description: '',
          bank: '',
          type: '',
          date: '',
          status: 'pending',
          user_id,
        },
      });
      const order = await createPaypalOrder({ amount, id: transaction.id });
      const approvalLink = order.links.find(
        (link: any) => link.rel === 'approve',
      )?.href;

      successResponse(res, 'Order created', {
        orderId: order.id,
        approvalLink,
      });
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  paypalCapture: async (req: Request, res: Response) => {
    try {
      const { token: orderId } = req.query;
      const accessToken = await generateAccessToken();
      const capture = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Captured:', capture.data);
      res.send('Payment completed');
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
};

export default paypalController;
