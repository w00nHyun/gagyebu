import express, { Application, NextFunction, Request, Response } from 'express';
import { MongoClient,ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { Db } from 'mongodb'
import bcrypt from 'bcrypt';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { Strategy as JwtStrategy, VerifiedCallback } from 'passport-jwt';
import cookieParser from 'cookie-parser';
import { emitWarning } from 'node:process';
import expenseRouter from './routes/expense'; // 방금 만든 라우터 불러오기
dotenv.config();



const app: Application = express();

app.use(express.static('public'));

// 폼(Form) 데이터를 req.body로 읽기 위한 설정
app.use(express.urlencoded({ extended: true }));

// JSON 데이터를 보낼 때 필요한 설정
app.use(express.json());
app.use(cookieParser());
//req.user에다가 저장하기
app.use((req: Request, res: Response, next: NextFunction) => {
  // 쿠키에 토큰이 없으면 그냥 통과 (비로그인 상태)
  if (!req.cookies?.token) {
    return next();
  }

  // 쿠키에 토큰이 있으면 passport로 검증해서 req.user 세팅!
  passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
    if (user) {
      req.user = user; // 여기서 모든 요청마다 req.user를 자동으로 채워줌!
      res.locals.user = user;
    }
    next();
  })(req, res, next);
});


//ejs 설정
app.set('view engine', 'ejs');

const PORT: number = Number(process.env.PORT) || 8080;
const url: string | undefined = process.env.MONGODB_URI;
if (typeof url === 'undefined') {
  console.error("환경변수 MONGODB_URI가 설정되지 않았습니다.");
  process.exit(1);
}
const client = new MongoClient(url);
const dbName = 'gagyebu';

//jwt secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';;

let db: Db;
async function connectDB(): Promise<void> {
  try {
    await client.connect();
    console.log('MongoDB 공식 드라이버로 연결 성공!');

    // client.db()는 확실하게 Db 인스턴스를 반환하므로 미리 정의한 db 변수에 대입합니다.
    db = client.db(dbName);
  } catch (error) {
    console.error('MongoDB 연결 실패:', error);
    process.exit(1);
  }
}
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 연결 성공`);
  });
});

const cookieExtractor = (req: any) => {
  return req?.cookies?.token || null;
};

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: cookieExtractor, // "요청이 오면 쿠키에서 'token'이라는 이름의 값을 꺼내와!"
      secretOrKey: JWT_SECRET,        // "그리고 우리가 만든 이 비밀키로 암호화가 맞는지 확인해!"
    },
    // 2. "토큰 검증이 성공하면 뭘 할까?" (콜백 함수) - 타입(any, VerifiedCallback) 추가
    async (jwtPayload: any, done: VerifiedCallback) => {
      try {
        // 검증이 통과되면 토큰 안의 유저 정보(jwtPayload)를 전달함
        // 이 done()의 두 번째 인자로 넘긴 데이터가 곧 req.user에 들어감!
        return done(null, jwtPayload);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);


//홈페이지 api
app.get('/', (req: Request, res: Response) => {
  try {
    console.log(req.user)
    res.render('home.ejs');
  } catch (err) {
    console.log(err);
    res.status(500).send("서버 에러");
  }
});

//middleWare (유효성 검사)
const vaildateExpense = (req: Request, res: Response, next: NextFunction) => {
  const { event, category, price, explanation, date, fixedCycle, fixedDayOrWeek, isFixed } = req.body;
  let fix: Boolean = (isFixed === 'on');

  const errors: Record<string, string> = {};
  if (event === '선택하세요...') errors.event = '이벤트명을 입력해주세요.';
  if (category === '선택하세요...') errors.category = '카테고리를 선택해주세요.';
  if (!price || isNaN(Number(price))) errors.price = '올바른 금액을 입력해주세요.';
  if (!explanation) errors.explanation = '설명을 입력해주세요.';

  // 2. 고정 지출 여부에 따른 조건부 검사
  if (fix) {
    // 고정 지출일 때 (date 제외, 주기 관련 필드 필수)
    if (!fixedCycle) errors.fixedCycle = '고정 주기를 선택해주세요.';
    if (!fixedDayOrWeek) errors.fixedDayOrWeek = '고정 요일/날짜를 선택해주세요.';
  } else {
    // 일반 지출일 때 (주기 관련 필드 제외, date 필수)
    if (!date) errors.date = '날짜를 입력해주세요.';
  }

  //error의 length가 1보다 크면 오류 메세지를 ejs에게 보냄. ejs에서 fetch를 이용해 클라이언트 사이드 렌더링 진행
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: '유효성 검사 실패',
      errors
    });
  }

  next();
};



//기본 인터페이스
interface expenseInfo {
  event: string,
  category: string,
  price: number,
  explanation: string,
  isFixed: boolean
  moneyType: 'expense',
  date: string
}



interface expenseFixInfo extends expenseInfo {
  fixedCycle: '매월' | '매주'
  fixedDayOrWeek: string
}


app.get('/expense/write', (req: Request, res: Response) => {
  try {
    res.render('expenseWrite.ejs');
  } catch (error) {
    console.log(error)
  }
});

//가계부 지출 내역 작성 api
app.post('/expense/post', vaildateExpense, async (req: Request, res: Response) => {
  try {
    console.log(req.body)
    //document에 담아야할 내용들을 req.body에서 받기
    const { event, category, price, fixedCycle, fixedDayOrWeek, explanation, isFixed, date } = req.body;
    //고정 수입인지 확인
    const fix = (isFixed === 'on');
    //기본 인터페이스에게서 타입 받아오기
    const baseInfo: expenseInfo = {
      event,
      category,
      price: Number(price),
      explanation,
      isFixed: fix,
      moneyType: 'expense',
      date
    };
    // fix의 bool타입에 의해서 타입 정하기
    const result: expenseInfo | expenseFixInfo = fix
      ? { ...baseInfo, fixedCycle, fixedDayOrWeek, }
      : { ...baseInfo, moneyType: 'expense' };
    await db.collection('transection').insertOne(result);
    res.status(200).json({
      success: true,
      message: "저장 완료"
    });

  }
  catch (error) {
    console.log(error);
  }
})

//지출 내역 api
app.get('/expense/list', async (req: Request, res: Response) => {
  try {
    let result: expenseInfo[] = await db.collection<expenseInfo>('transection').find({ moneyType: 'expense' }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);
    console.log(result);
    res.render('expenseList.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
    res.send(400);
  }
})

//고정 지출 내역 api
app.get('/expense/fixedCost/list', async (req: Request, res: Response) => {
  try {
    let result: expenseInfo[] = await db.collection<expenseInfo>('transection').find({ isFixed: true }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);
    res.render('expenseFixed.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
  }
})
interface GroupStat<T> {
  _id: T;
  total: number;
}

/**  고정값 여부에 따른 값을 주는 함수 */
const fixEval = (fixStat: GroupStat<boolean>[]): number[] => {
  let ret: number[] = [0, 0];

  fixStat.forEach(element => {
    if (element._id) {
      ret[0] = element.total;
    } else {
      ret[1] = element.total;
    }
    // forEach 안에서의 return은 아무런 효과가 없으므로 지워야 합니다.
  });

  return ret; // 함수가 최종적으로 ret 배열을 반환해야 합니다.
}

function mapStatsToLabels(statsArray: { _id: string; total: number }[], labels: string[]): number[] {
  const statsMap: Record<string, number> = {};

  // forEach를 사용해 빈 객체(statsMap)에 값 채워넣기
  statsArray.forEach(item => {
    if (item._id !== null && item._id !== undefined) {
      statsMap[String(item._id)] = item.total;
    }
  });

  return labels.map(label => statsMap[label] || 0);
}

//예산 설정 api 
app.get('/stat', async (req: Request, res: Response) => {

  //통계 및 분석 페이지에 나와야 되는 화면 //여기에 목표도 설정하면 됨. 차트로 어떤 카테고리를 어떤 비율로 했는지 //카테고리랑 그룹만 차트화 시키면 됨 
  //  지출 현황을 보여주고 나의 목표보다 얼마나 더 썼는지 더 안썻는지 등을 보여줌.
  //1. 페이지에 가져와야할 정보 (그룹,이벤트),(카테고리), 가격 돈, 고정비인지에 대한 db 내용 다 가져옴. 
  //2. 차트 라이브러리 가져와서 저기에다가 내용집어넣기. 카테고리 별로 나누기는 어케하는게 좋을까에 대해 고민을 좀 더 하긴 해야할 듯
  //통계는 1달단위가 깔끔해보임. 
  try {
    let fixData: number[] = [];
    let categoryData: number[];
    let eventData: number[];
    let categoryLabel: string[] = ['식비', '교통비', '주거/통신', '문화/여가', '구독비', '쇼핑비', '병원비', '기타'];
    let eventLabel: string[] = ['개인지출', '친구', '데이트', '지인', '가족', '비즈니스', '기타이벤트'];
    const [stats] = await db.collection('transection').aggregate([
      {
        $match: {}
      },

      // 2단계: $facet으로 다중 집계 시작
      {
        $facet: {
          // 갈래 1: 카테고리별 집계
          categoryStats: [
            { $group: { _id: "$category", total: { $sum: "$price" } } }
          ],
          // 갈래 2: 이벤트(그룹)별 집계
          eventStats: [
            { $group: { _id: "$event", total: { $sum: "$price" } } } // 필드명이 group인지 event인지 확인 필요
          ],
          // 갈래 3: 고정비 여부별 집계 (true/false)
          fixedStats: [
            { $group: { _id: "$isFixed", total: { $sum: "$price" } } }
          ]
        }
      }
    ]).toArray();

    fixData = fixEval(stats.fixedStats);
    categoryData = mapStatsToLabels(stats.categoryStats, categoryLabel);
    eventData = mapStatsToLabels(stats.eventStats, eventLabel);

    const chartData = {
      fixData: fixData,
      categoryData: categoryData,
      eventData: eventData,
      categoryLabel: categoryLabel,
      eventLabel: eventLabel
    }
    res.render('expenseChart.ejs', { chartData: chartData });

  } catch (error) {
    console.log(error)
  }
})


//삭제 api , 수정 api //expense/write  api 


//예산 설정 api
app.get('/plan/budget', (req: Request, res: Response) => {
  try {
    res.render('budgetPlan.ejs');
  } catch (error) {
    console.log(error);
  }
})
//예산 설정 인터페이스
interface budgetPlan {
  planType: 'weekly' | 'monthly',
  period: string,
  budget: number
}
app.post('/plan/budget/save', async (req: Request, res: Response) => {
  try {
    const { planType, period, budget } = req.body;
    let planMemory: budgetPlan = {
      planType,
      period,
      budget
    }
    await db.collection('plan').insertOne(planMemory);
  } catch (error) {

  }
})

app.get('/report', (req: Request, res: Response) => {
  res.render('report.ejs');
})

//login get 요청
app.get('/login', (req: Request, res: Response) => {
  res.render('login.ejs');
})

interface User {
  _id?: ObjectId;
  username: string,
  password: string,
}


//login POST 요청 
app.post('/login/request', async (req: Request, res: Response) => {
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
app.get('/register', (req: Request, res: Response) => {
  try {
    res.render('register.ejs',{user:req.user});
  } catch (error) {
    console.log(error)
  }
})


app.post('/register/request', async (req: Request, res: Response) => {
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