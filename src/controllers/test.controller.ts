import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import { fbTest } from '../workers/fb-test';

const testController = {
  createtest: async (req: Request, res: Response): Promise<void> => {
    try {
      const job = await fbTest.add({
        data: 'test',
        timestamp: new Date().toISOString(),
        requestId: req.body?.requestId || `req_${Date.now()}`,
      });
      console.log('🔥 New job added:', job.id);
      successResponse(res, 'Test', 'test');
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

export default testController;
