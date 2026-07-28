import express, { Application, NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { connectDB,db,ObjectId } from './config/database';
import configPassport from './config/passport';
import { emitWarning } from 'node:process';
import authRouter from './routes/auth';
import expenseRouter from './routes/expense';
dotenv.config();



const app: Application = express();

app.use(express.static('public'));

// 폼(Form) 데이터를 req.body로 읽기 위한 설정
app.use(express.urlencoded({ extended: true }));

// JSON 데이터를 보낼 때 필요한 설정
app.use(express.json());
//쿠기 내용 읽기
app.use(cookieParser());
//passport import
configPassport();
app.use(passport.initialize());

//req.user에다가 저장하기
app.use((req: Request, res: Response, next: NextFunction) => {
  // 쿠키에 토큰이 없으면 그냥 통과 (비로그인 상태)
   res.locals.user = null;
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


connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 연결 성공`);
  });
});


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

app.use('', authRouter);  //auth 관련된 것들


app.use('/expense', expenseRouter); //가계부 작성, 내역보기, 고정지출




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

