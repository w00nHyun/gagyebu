import express, { Application, NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { connectDB, db, ObjectId } from './config/database';
import configPassport from './config/passport';
import { emitWarning } from 'node:process';
import authRouter from './routes/auth';
import expenseRouter from './routes/expense';
import requireAuth from './middleware/auth.middleware';
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

//데이터 형식 모음 
interface UserPayLoad {
  username: string,
  userId: string
}

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
app.get('/stat', requireAuth, async (req: Request, res: Response) => {

  //통계 및 분석 페이지에 나와야 되는 화면 //여기에 목표도 설정하면 됨. 차트로 어떤 카테고리를 어떤 비율로 했는지 //카테고리랑 그룹만 차트화 시키면 됨 
  //  지출 현황을 보여주고 나의 목표보다 얼마나 더 썼는지 더 안썻는지 등을 보여줌.
  //1. 페이지에 가져와야할 정보 (그룹,이벤트),(카테고리), 가격 돈, 고정비인지에 대한 db 내용 다 가져옴. 
  //2. 차트 라이브러리 가져와서 저기에다가 내용집어넣기. 카테고리 별로 나누기는 어케하는게 좋을까에 대해 고민을 좀 더 하긴 해야할 듯
  //통계는 1달단위가 깔끔해보임. 
  try {
    let user = req.user as UserPayLoad;
    let fixData: number[] = [];
    let categoryData: number[];
    let eventData: number[];
    let categoryLabel: string[] = ['식비', '교통비', '주거/통신', '문화/여가', '구독비', '쇼핑비', '병원비', '기타'];
    let eventLabel: string[] = ['개인지출', '친구', '데이트', '지인', '가족', '비즈니스', '기타이벤트'];
    const [stats] = await db.collection('transection').aggregate([
      {
        $match: {
          userId: user.userId
        }
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
app.get('/plan/budget', requireAuth, (req: Request, res: Response) => {
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

app.get('/calendar', requireAuth, (req: Request, res: Response) => {
  try {
    //달력 기능 

    //1. 서버사이드 렌더링이랑 클라이언트 사이드 렌더링중에 어떤걸 할건가? 
    //1.1. 새로고침 없이 데이터들을 많이 바꿔야 하므로 클라이언트 사이드 렌더링이 맞는듯 
    //2. 달력에 줄 데이터들은 기본 설정 월에 맞춰서 갖다주기 
    //3. 내역을 누르면 그게 뭐에 쓴 내용인지 카드 형태로 보여주기 

    //4. 그럼 서버 코드는 어떻게 짜야하나? 

    //1. 현재 월에 맞는 데이터들을 toarray로 찾아서 일별 오름차순으로 정리해서 클라이언트에 전송
    //1.1. 1번 문제를 하기 위해 먼저 해야하는 일 소비일을 저장할 때 연도 월 일을 따로 저장해야함.(해결 완료)
    //2. 일을 클릭하면 그 일에 맞는 데이터를 전송 
    res.render('calendar.ejs');
  } catch (error) {
    console.log(error);
  }
})

app.get('/calendar/data', requireAuth, async (req: Request, res: Response) => {
  try {
    let user = req.user as UserPayLoad;
    const from = req.query.from as string;
    const to = req.query.to as string;
    //쿼리 파라미터 값이 없는 경우
    if (!from || !to) {
      return res.status(400).json({ message: 'from 및 to 쿼리 파라미터를 모두 전달해주세요.' });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    //날짜 형식이 이상한지 확인
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        message: '올바른 날짜 형식이 아닙니다. (예: YYYY-MM-DD)'
      });
    }
    const fromParts = from.split('-').map(Number);
    const toParts = to.split('-').map(Number);

    //연도,월,일을 숫자로 저장
    const [fromYear, fromMonth, fromDay] = fromParts;
    const [toYear, toMonth, toDay] = toParts;

    //기간 from에서 to 오류 막기 위해
    if (fromYear > toYear) {
      return res.status(400).json({ message: '쿼리파라미터 기간 유효성 오류' });
    }
    if (fromYear == toYear) {
      if (fromMonth > toMonth) {
        return res.status(400).json({ message: '쿼리파라미터 기간 유효성 오류' });
      }
      else if (fromMonth == toMonth && fromDay > toDay) {
        return res.status(400).json({ message: '쿼리파라미터 기간 유효성 오류' });
      }
    }

    // 날짜 범위 내의 거래 항목 조회
    const buildDateInt = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
    const fromInt = buildDateInt(fromYear, fromMonth, fromDay);
    const toInt = buildDateInt(toYear, toMonth, toDay);

    const rawItems = await db.collection('transection').aggregate([
      {
        $match: {
          userId: req.user && (req.user as UserPayLoad).userId,
          $expr: {
            $and: [
              { $gte: [
                { $add: [ { $multiply: ["$year", 10000] }, { $multiply: ["$month", 100] }, "$day" ] },
                fromInt
              ] },
              { $lte: [
                { $add: [ { $multiply: ["$year", 10000] }, { $multiply: ["$month", 100] }, "$day" ] },
                toInt
              ] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          event: 1,
          category: 1,
          price: 1,
          explanation: 1,
          isFixed: 1,
          moneyType: 1,
          year: 1,
          month: 1,
          day: 1
        }
      }
    ]).toArray();

    // from -> to 기간의 모든 날짜를 초기화
    const days: Array<{ date: string; year: number; month: number; day: number; items: any[]; incomeTotal: number; expenseTotal: number }> = [];
    const dayMap: Record<string, { date: string; year: number; month: number; day: number; items: any[]; incomeTotal: number; expenseTotal: number }> = {};

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

    for (let d = new Date(fromYear, fromMonth - 1, fromDay); d <= new Date(toYear, toMonth - 1, toDay); d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const dateString = formatDate(y, m, day);
      const entry = { date: dateString, year: y, month: m, day, items: [], incomeTotal: 0, expenseTotal: 0 };
      days.push(entry);
      dayMap[dateString] = entry;
    }

    // rawItems를 매핑
    rawItems.forEach((it: any) => {
      const dateString = formatDate(it.year, it.month, it.day);
      const entry = dayMap[dateString];
      if (!entry) return; // 범위를 벗어나면 무시

      const amount = Number(it.price) || 0;
      entry.items.push(it);
      if ((it.moneyType || 'expense') === 'income') entry.incomeTotal += amount;
      else entry.expenseTotal += amount;
    });

    // 요약(선택)
    const summary = days.reduce(
      (acc, cur) => {
        acc.totalIncome += cur.incomeTotal;
        acc.totalExpense += cur.expenseTotal;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );

    return res.json({ startDate: from, endDate: to, days, summary });
  } catch (err) {
    console.log(err);
    res.json(500);
  }
})