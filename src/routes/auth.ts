// routes/auth.ts
import { Router, Request, Response, response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { syncFixedExpenses } from '../middleware/expense.middleware';
import { User } from '../types/user'; // User 인터페이스 경로


const router = Router();

router.get('/login', (req: Request, res: Response) => {
  try {
    res.render('login.ejs');
  } catch (error) {

  }
})
// 1. 프론트엔드에서 [구글 로그인] 버튼 누르면 도착하는 주소
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// 2. 구글 콘솔에 등록했던 그 리디렉션 URI 주소! (/auth/google/callback)
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req: Request, res: Response) => {
    try {
      // passport.ts의 done(null, user)에서 넘겨준 DB 유저 객체
      const user = req.user as User;

      if (!user) {
        return res.redirect('/login');
      }

      const userIdStr = user._id ? user._id.toString() : '';

      // 💡 A. 로그인 성공 시 실행할 로직 (고정지출 자동 동기화)
      if (userIdStr) {
        // regular 컬렉션을 조회하여 당월까지 생성 안 된 고정지출 내역을 transection에 자동 추가하고 lastUpdate를 갱신함
        await syncFixedExpenses(userIdStr);
      }

      // 💡 B. JWT 토큰 생성 (12시간 설정)
      const token = jwt.sign(
        { userId: userIdStr, name: user.name },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '12h' }
      );

      // 💡 C. 브라우저 쿠키에 HTTP-Only로 토큰 저장 (12시간 설정)
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000, // 12시간 (ms)
      });

      // 💡 D. 모든 로그인 처리가 끝났으니 메인 페이지(홈)로 이동!
      return res.redirect('/');

    } catch (error) {
      console.error('구글 로그인 콜백 동기화 처리 에러:', error);
      return res.redirect('/login');
    }
  }
);
// 3. 로그아웃 (쿠키 삭제)
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.redirect('/login');
});

export default router;