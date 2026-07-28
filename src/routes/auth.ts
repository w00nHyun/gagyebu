import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {ObjectId, db } from '../config/database';

const router = Router();

//login get 요청
router.get('/login', (req: Request, res: Response) => {
  res.render('login.ejs');
})

interface User {
  _id?: ObjectId;
  username: string,
  password: string,
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

//login POST 요청 
router.post('/login/request', async (req: Request, res: Response) => {
  try {
    let result: null | User = await db.collection<User>('user').findOne({ username: req.body.username });
    if (result === null) {
      return res.redirect('/login?err=wrongName');
    }

    // 2. 비밀번호 검증
    const isMatch: boolean = await bcrypt.compare(req.body.password, result.password);

    // 비밀번호가 틀린 경우
    if (!isMatch) {
      return res.redirect('/login?err=wrongPass');
    }

    const token = jwt.sign(
      { userId: result._id, username: result.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. 쿠키(Cookie)에 토큰을 실어서 브라우저로 보냄
    res.cookie('token', token, {
      httpOnly: true, // 자바스크립트로 접근 못하게 막아 보안 강화 (XSS 방지)
      maxAge: 3600000, // 1시간 동안 유효
      // secure: true,   // 3. HTTPS 연결에서만 쿠키 전송 (실무 필수)
      sameSite: 'lax' // 4. CSRF 공격 방지 (기본값 설정 권장)
    });

    // 3. 메인 페이지로 이동 (브라우저는 위에서 설정한 쿠키를 자동으로 가지고 감)
    return res.redirect('/');
    // 1. id가 동일한 user 정보를 db에서 찾음.
    // 2. 비밀번호 해시한 거랑 DB에 있는 해시된 비밀번호랑 같은 지 확인 
    // 3. 맞으면 jwt 지급
  } catch (error) {
    console.log(error);
  }
})

//register get 요청
router.get('/register', (req: Request, res: Response) => {
  try {
    res.render('register.ejs',{user:req.user});
  } catch (error) {
    console.log(error)
  }
})


router.post('/register/request', async (req: Request, res: Response) => {
  try {
    console.log(req.body);
    const username: string = req.body.username;
    const purePassword: string = req.body.password;
    const pureRePassword: string = req.body.rePassword;
    const password: string = await bcrypt.hash(purePassword, 10);


    let idFound: User | null = await db.collection<User>('user').findOne({ username: username });
    let user: User = {
      username,
      password: password
    }
    if (idFound === null) {
      if (purePassword === pureRePassword) {
        await db.collection<User>('user').insertOne(user);
        res.redirect('/');
      }
      else {
        res.redirect('/register?err=wrongPass');
      }
    }
    //1. id가 중복인지 확인
    //2. 비밀번호가 비밀번호확인칸이랑 같은 지 확인
    //3. 같으면 user DB에 내용 저장

  } catch (err) {
    console.log(err);
  }
})


export default router;