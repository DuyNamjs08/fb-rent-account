import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';

const now = new Date();
const firstDayThisMonth = startOfMonth(now);
const firstDayLastMonth = startOfMonth(subMonths(now, 1));
const lastDayLastMonth = endOfMonth(subMonths(now, 1));

const calcGrowth = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};
const statisticsController = {
  getStatistics: async (req: Request, res: Response): Promise<void> => {
    try {
      // Lấy dữ liệu giao dịch tháng vừa rồi và tháng cũ
      const [thisMonthTransactions, lastMonthTransactions] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            created_at: {
              gte: firstDayThisMonth,
            },
          },
        }),
        prisma.transaction.findMany({
          where: {
            created_at: {
              gte: firstDayLastMonth,
              lte: lastDayLastMonth,
            },
          },
        }),
      ]);
      // Lấy dữ liệu người dùng
      const [thisMonthUsers, lastMonthUsers] = await Promise.all([
        prisma.user.count({
          where: {
            created_at: {
              gte: firstDayThisMonth,
            },
          },
        }),
        prisma.user.count({
          where: {
            created_at: {
              gte: firstDayLastMonth,
              lte: lastDayLastMonth,
            },
          },
        }),
      ]);
      // Lấy dữ liệu ads
      const [thisMonthAds, lastMonthAds] = await Promise.all([
        prisma.adsAccount.count({
          where: {
            created_at: {
              gte: firstDayThisMonth,
            },
          },
        }),
        prisma.adsAccount.count({
          where: {
            created_at: {
              gte: firstDayLastMonth,
              lte: lastDayLastMonth,
            },
          },
        }),
      ]);
      // Tính tổng doanh thu
      const thisMonthRevenue = thisMonthTransactions.reduce(
        (acc, cur) => acc + cur.amountVND,
        0,
      );
      const lastMonthRevenue = lastMonthTransactions.reduce(
        (acc, cur) => acc + cur.amountVND,
        0,
      );
      // Tính tăng trưởng
      const revenueGrowth = calcGrowth(thisMonthRevenue, lastMonthRevenue);
      const transactionGrowth = calcGrowth(
        thisMonthTransactions.length,
        lastMonthTransactions.length,
      );
      const userGrowth = calcGrowth(thisMonthUsers, lastMonthUsers);
      const adsGrowth = calcGrowth(thisMonthAds, lastMonthAds);
      // Tổng hợp số lượng hiện tại
      const countTransaction = await prisma.transaction.count();
      const countUser = await prisma.user.count();
      const countAds = await prisma.adsAccount.count();
      const response = {
        countTransaction,
        revenue: { amountVND: thisMonthRevenue },
        countUser,
        countAds,
        revenueGrowth, // %
        transactionGrowth, // %
        userGrowth, // %
        adsGrowth, // %
      };
      successResponse(res, 'Statistics success ', response);
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

export default statisticsController;
