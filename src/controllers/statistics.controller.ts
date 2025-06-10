import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import {
  startOfMonth,
  subMonths,
  endOfMonth,
  addMonths,
  format,
  parse,
  differenceInMonths,
  isMatch,
} from 'date-fns';
interface MonthlyStat {
  month: string;
  revenue: number;
  newUsers: number;
  newAdsAccounts: number;
}

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
  getStatisticsMonthly: async (req: Request, res: Response): Promise<void> => {
    try {
      const { targetDayFrom, targetDayTo } = req.query;
      // Kiểm tra định dạng YYYY/MM/DD
      const dateFormat = 'yyyy/MM/dd';
      if (
        !isMatch(targetDayFrom as string, dateFormat) ||
        !isMatch(targetDayTo as string, dateFormat)
      ) {
        errorResponse(
          res,
          'Định dạng ngày không hợp lệ. Định dạng yêu cầu: YYYY/MM/DD',
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const fromDate = startOfMonth(
        parse(targetDayFrom as string, dateFormat, new Date()),
      );
      const toDate = startOfMonth(
        addMonths(parse(targetDayTo as string, dateFormat, new Date()), 1),
      );
      const daysDiff = differenceInMonths(toDate, fromDate);
      if (daysDiff > 6) {
        errorResponse(
          res,
          'Khoảng thời gian tối đa là 6 tháng',
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      // Tạo danh sách các tháng
      const months: { label: string; start: Date; end: Date }[] = [];
      let current = new Date(fromDate);
      while (current < toDate) {
        const start = startOfMonth(current);
        const end = startOfMonth(addMonths(start, 1));
        months.push({ label: format(start, 'yyyy-MM'), start, end });
        current = end;
      }
      // Lấy dữ liệu
      const [transactions, users, adsAccounts] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            status: 'success',
            created_at: { gte: fromDate, lt: toDate },
          },
          select: {
            amountVND: true,
            created_at: true,
          },
        }),
        prisma.user.findMany({
          where: {
            created_at: { gte: fromDate, lt: toDate },
          },
          select: {
            created_at: true,
          },
        }),
        prisma.adsAccount.findMany({
          where: {
            created_at: { gte: fromDate, lt: toDate },
          },
          select: {
            created_at: true,
          },
        }),
      ]);
      // Thống kê theo tháng
      const monthlyStats: MonthlyStat[] = months.map(
        ({ label, start, end }) => {
          const revenue = transactions
            .filter((tx) => tx.created_at >= start && tx.created_at < end)
            .reduce((sum, tx) => sum + tx.amountVND, 0);
          const newUsers = users.filter(
            (u) => u.created_at >= start && u.created_at < end,
          ).length;
          const newAdsAccounts = adsAccounts.filter(
            (a) => a.created_at >= start && a.created_at < end,
          ).length;
          return { month: label, revenue, newUsers, newAdsAccounts };
        },
      );
      // Tổng
      const totalRevenue = monthlyStats.reduce((sum, m) => sum + m.revenue, 0);
      const totalUsers = monthlyStats.reduce((sum, m) => sum + m.newUsers, 0);
      const totalAdsAccounts = monthlyStats.reduce(
        (sum, m) => sum + m.newAdsAccounts,
        0,
      );
      res.json({
        monthlyStats,
        totals: {
          totalRevenue,
          totalUsers,
          totalAdsAccounts,
        },
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
};

export default statisticsController;
