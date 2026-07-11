import express, { Application, Request, Response } from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import {Db} from 'mongodb'
import { emitWarning } from 'node:process';
import expenseRouter from './routes/expense'; // 방금 만든 라우터 불러오기
dotenv.config();



const app: Application= express();

app.use(express.static('public')); 

// 폼(Form) 데이터를 req.body로 읽기 위한 설정
app.use(express.urlencoded({ extended: true }));

// JSON 데이터를 보낼 때 필요한 설정
app.use(express.json());

//ejs 설정
app.set('view engine', 'ejs');

const PORT : number = Number(process.env.PORT) || 8080;
const url : string | undefined= process.env.MONGODB_URI;
if (typeof url==='undefined') {
  console.error("환경변수 MONGODB_URI가 설정되지 않았습니다.");
  process.exit(1);
}
const client = new MongoClient(url);
const dbName='gagyebu';

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



app.get('/', (req: Request, res: Response) => {
  try {
    res.render('home.ejs');
  } catch (err) {
    console.log(err);
    res.status(500).send("서버 에러");
  }
});

interface moneyInfo{
  event : string,
  category : string,
  price : number,
  date : string,
  explanation  : string
}
interface expenseInfo extends moneyInfo{
  moneyType : 'expense'
}

interface incomeInfo extends moneyInfo{
  moneyType : 'income'
}

app.get('/expense/write', (req: Request, res: Response) => {
  try {
    res.render('expenseWrite.ejs');
  } catch (error) {
    console.log(error) 
  }
});

app.post('/expense/post',async(req:Request,res : Response)=>{
  try {
  let result : expenseInfo = {
    event : req.body.event,
    category : req.body.category,
    price : Number(req.body.price),
    date : req.body.date,
    explanation  : req.body.explanation,
    moneyType : 'expense'
  }
  console.log(result);
  if(result.category!=undefined && result.event!=undefined && result.price>0 && result.date!='' && result.explanation!=''){
    await db.collection('transection').insertOne(result);
    res.redirect('/expense/list')
  }
  res.redirect('/expense/write');
  } 
  catch (error) {
    console.log(error);
  }
})

app.get('/expense/list',async(req:Request,res:Response)=>{
  let result :expenseInfo[] = await db.collection<expenseInfo>('transection').find({moneyType : 'expense'}).toArray();
  const total :number = result.reduce((sum, item) => sum + item.price, 0);
  console.log(result);
  res.render('expenseList.ejs',{items : result, total : total});
})
  