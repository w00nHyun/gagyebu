import express, { Application, NextFunction, Request, Response } from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { Db } from 'mongodb'
import { emitWarning } from 'node:process';
import expenseRouter from './routes/expense'; // 방금 만든 라우터 불러오기
dotenv.config();



const app: Application = express();

app.use(express.static('public'));

// 폼(Form) 데이터를 req.body로 읽기 위한 설정
app.use(express.urlencoded({ extended: true }));

// JSON 데이터를 보낼 때 필요한 설정
app.use(express.json());

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


//홈페이지 api
app.get('/', (req: Request, res: Response) => {
  try {
    res.render('home.ejs');
  } catch (err) {
    console.log(err);
    res.status(500).send("서버 에러");
  }
});
//middleWare
const vaildateExpense = (req: Request, res: Response, next: NextFunction) => {
  const { event, category, price, explanation, date, fixedCycle, fixedDayOrWeek, isFixed } = req.body;
  let fix: Boolean = (isFixed === 'on');

  const errors: Record<string, string> = {};
  if (event==='선택하세요...') errors.event = '이벤트명을 입력해주세요.';
  if (category==='선택하세요...') errors.category = '카테고리를 선택해주세요.';
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
}
//지출 인터페이스
interface expenseNonFixInfo extends expenseInfo {
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
      moneyType: 'expense'
    };
    // fix의 bool타입에 의해서 타입 정하기
    const result: expenseFixInfo | expenseNonFixInfo = fix
      ? { ...baseInfo, fixedCycle, fixedDayOrWeek, }
      : { ...baseInfo, date, moneyType: 'expense' };

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
    let result: expenseNonFixInfo[] = await db.collection<expenseNonFixInfo>('transection').find({ moneyType: 'expense' }).toArray();
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
    let result: expenseNonFixInfo[] = await db.collection<expenseNonFixInfo>('transection').find({ isFixed: true }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);
    res.render('expenseFixed.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
  }
})