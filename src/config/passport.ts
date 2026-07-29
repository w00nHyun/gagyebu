import passport from 'passport';
import { Strategy as JwtStrategy, VerifiedCallback } from 'passport-jwt';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

const cookieExtractor = (req: any) => {
  return req?.cookies?.token || null;
};
const configPassport = () => {
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: cookieExtractor, // "요청이 오면 쿠키에서 'token'이라는 이름의 값을 꺼내와!"
      secretOrKey: JWT_SECRET,        // "그리고 우리가 만든 이 비밀키로 암호화가 맞는지 확인해!"
    },
    // 2. "토큰 검증이 성공하면 뭘 할까?" (콜백 함수) - 타입(any, VerifiedCallback) 추가
    async (jwtPayload: any, done: VerifiedCallback) => {
      try {
       
        return done(null, jwtPayload);
      } catch (error) {
        return done(error, false);
      }
    }
  )
)};


export default configPassport;