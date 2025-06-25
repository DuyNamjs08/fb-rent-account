import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export async function setLanguageFromConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const config = await prisma.config.findFirst({
      where: { name: 'config-settings' },
    });
    const lang = config?.lang || 'vi';
    req.headers['accept-language'] = lang;
    req.language = lang;
    req.i18n?.changeLanguage(lang);

    next();
  } catch (err) {
    console.error('Error loading config:', err);
    next();
  }
}
