import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { syncFixedExpenses } from '../middleware/expense.middleware';
import { User } from '../types/user';

const router = Router();

router.get('/login', (req: Request, res: Response) => {
  res.render('login.ejs');
});

router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;

      if (!user) {
        return res.redirect('/login');
      }

      const userId = user._id ? user._id.toString() : '';

      if (userId) {
        await syncFixedExpenses(userId);
      }

      const token = jwt.sign(
        { userId, name: user.name },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '12h' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000
      });

      return res.redirect('/');
    } catch (error) {
      console.error('구글 로그인 콜백 동기화 처리 에러:', error);
      return res.redirect('/login');
    }
  }
);

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.redirect('/login');
});

export default router;
