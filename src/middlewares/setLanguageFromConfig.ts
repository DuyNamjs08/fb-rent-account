import { Request, Response, NextFunction } from 'express';

export async function setLanguageFromConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const lang = req.headers['accept-language'] || 'vi';
    req.language = lang;
    req.i18n?.changeLanguage(lang);

    next();
  } catch (err) {
    console.error('Error loading config:', err);
    next();
  }
}
