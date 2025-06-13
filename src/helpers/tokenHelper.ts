import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import { errorResponse } from './response';
import prisma from '../config/prisma';

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'your-secret-key';

async function getUserFromToken(req: Request, res: Response) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    errorResponse(
      res,
      httpReasonCodes.UNAUTHORIZED,
      {},
      httpStatusCodes.UNAUTHORIZED,
    );
    return;
  }

  const token = authorizationHeader.split(' ')[1];
  if (!token) {
    errorResponse(
      res,
      httpReasonCodes.UNAUTHORIZED,
      {},
      httpStatusCodes.UNAUTHORIZED,
    );
    return;
  }
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
  if (typeof decoded === 'object') {
    const user = await prisma.user.findUnique({
      where: { id: decoded.user_id },
    });
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }
    return user;
  } else {
    errorResponse(
      res,
      httpReasonCodes.UNAUTHORIZED,
      {},
      httpStatusCodes.UNAUTHORIZED,
    );
    return;
  }
}

export { getUserFromToken };
