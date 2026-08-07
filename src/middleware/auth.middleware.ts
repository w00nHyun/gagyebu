// middlewares/auth.ts (또는 기존 requireAuth 파일)
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 💡 Express Request에 req.user 타입 추가 정의
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. 쿠키에서 JWT 토큰 꺼내기 (app.ts에 cookie-parser 등록 필수)
  const token = req.cookies?.token;

  // 2. 토큰이 없으면 로그인 페이지로 리디렉션
  if (!token) {
    return res.redirect('/login');
  }

  try {
    // 3. JWT 토큰 해독 및 유효성 검증
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    ) as { userId: string; email: string };

    // 💡 4. 핵심! 해독한 유저 정보를 req.user에 넣어줍니다.
    // (이렇게 해두면 라우터나 컨트롤러에서 req.user.userId를 그대로 쓸 수 있습니다!)
    (req as AuthRequest).user = decoded;

    next(); // 다음 미들웨어/컨트롤러로 통과!
  } catch (err) {
    console.error('JWT 토큰 검증 실패:', (err as Error).message);
    // 토큰이 위조되었거나 만료된 경우 쿠키 삭제 후 로그인으로
    res.clearCookie('token');
    return res.redirect('/login');
  }
}