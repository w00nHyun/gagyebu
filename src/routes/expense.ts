import express, { Router, Request, Response, NextFunction } from 'express';
import {ObjectId, db } from '../config/database';

const router: Router = express.Router();


interface expenseInfo {
  event: string,
  category: string,
  price: number,
  explanation: string,
  isFixed: boolean,
  moneyType: 'expense',
  date: string,
}





router.get('/write', (req: Request, res: Response) => {
  try {
    console.log(req.user);
    res.render('expenseWrite.ejs');
  } catch (error) {
    console.log(error)
  }
});

//middleWare (유효성 검사)
const vaildateExpense = (req: Request, res: Response, next: NextFunction) => {
  const { event, category, price, explanation, date, isFixed } = req.body;
  let fix: Boolean = (isFixed === 'on');

  const errors: Record<string, string> = {};
  if (event === '선택하세요...') errors.event = '이벤트명을 입력해주세요.';
  if (category === '선택하세요...') errors.category = '카테고리를 선택해주세요.';
  if (!price || isNaN(Number(price))) errors.price = '올바른 금액을 입력해주세요.';
  if (!explanation) errors.explanation = '설명을 입력해주세요.';
  if (!date) errors.date = '날짜를 입력해주세요.';


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


//가계부 지출 내역 작성 api
router.post('/post', vaildateExpense, async (req: Request, res: Response) => {
  try {
    

    //document에 담아야할 내용들을 req.body에서 받기
    const { event, category, price, explanation, isFixed, date } = req.body;
    console.log(req.user);
    //user 정보 받아서 넣기... 
    //req.user로 받기
    
    //고정 수입인지 확인
    const fix : boolean = (isFixed === 'on');
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
    const result: expenseInfo  = baseInfo;
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
router.get('/list', async (req: Request, res: Response) => {
  try {
    let result: expenseInfo[] = await db.collection<expenseInfo>('transection').find({ moneyType: 'expense' }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);
    
    res.render('expenseList.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
    res.send(400);
  }
})

//고정 지출 내역 api
router.get('/fixedCost/list', async (req: Request, res: Response) => {
  try {
    let result: expenseInfo[] = await db.collection<expenseInfo>('transection').find({ isFixed: true }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);
    res.render('expenseFixed.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
  }
})

// 메인 파일에서 가져다 쓸 수 있도록 내보내기
export default router;