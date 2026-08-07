// routes/auth.ts
import { Router, Request, Response, response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '../types/user'; // User 인터페이스 경로


const router = Router();

router.get('/login',(req:Request,res:Response)=>{
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
    // passport.ts의 done(null, user)에서 넘겨준 DB 유저 객체
    const user = req.user as User;

    if (!user) {
      return res.redirect('/login');
    }

    const userIdStr = user._id ? user._id.toString() : '';

    // 💡 A. 로그인 성공 시 실행할 로직 (예: 이번 달 고정지출 1회 체크)
    // if (userIdStr) {
    //   await processRecurringExpenses(userIdStr);
    // }

    // 💡 B. JWT 토큰 생성 (userId와 email 담기)
    const token = jwt.sign(
      { userId: userIdStr, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // 💡 C. 브라우저 쿠키에 HTTP-Only로 토큰 저장
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // 💡 D. 모든 로그인 처리가 끝났으니 메인 페이지(홈)로 이동!
    res.redirect('/');
  }
);

// 3. 로그아웃 (쿠키 삭제)
router.get('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.redirect('/login');
});

export default router;