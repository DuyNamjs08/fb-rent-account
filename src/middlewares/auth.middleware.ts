import { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from '../helpers/tokenHelper';

export const requireRoles = (rolesRequired: string[] = []) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await getUserFromToken(req, res);
      if (!user) return;
      if (!user.role || !rolesRequired.includes(user.role)) {
        res.status(403).json({ message: 'Không có quyền truy cập' });
        return;
      }
      (req as any).user = user;
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
};
