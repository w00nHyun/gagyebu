import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { db } from './database'; // db 연결 객체 경로
import { User } from '../types/user';

// 💡 configPassport 함수로 감싸서 export
export function configPassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: '/auth/google/callback',
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0].value || '';
          const name = profile.displayName;

          const usersCollection = db.collection<User>('users');

          // 1. googleId로 기존 유저 조회
          let user : User | null = await usersCollection.findOne({ googleId });

          // 2. 이메일로 연동 확인
          if (!user && email) {
            user = await usersCollection.findOne({ email });
            if (user) {
              await usersCollection.updateOne(
                { _id: user._id },
                { $set: { googleId } }
              );
              user.googleId = googleId;
            }
          }

          // 3. 신규 유저 생성
          if (!user) {
            const newUser: Omit<User, '_id'> = {
              email,
              name,
              googleId,
              createdAt: new Date(),
            };
            const result = await usersCollection.insertOne(newUser as User);
            user = { _id: result.insertedId, ...newUser } as User;
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      }
    )
  );
}