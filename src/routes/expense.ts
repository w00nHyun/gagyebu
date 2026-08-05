import express, { Router, Request, Response, NextFunction } from 'express';
import { ObjectId, db } from '../config/database';
import requireAuth from '../middleware/auth.middleware';
import validateExpense from '../middleware/validation.middleware';
const router: Router = express.Router();


interface expenseInfo extends UserPayLoad {
  userId: string,
  username: string,
  event: string,
  category: string,
  price: number,
  explanation: string,
  isFixed: boolean,
  moneyType: 'expense',
  year: number,
  month: number,
  day: number
}

interface UserPayLoad {
  username: string,
  userId: string
}




router.get('/write', requireAuth, (req: Request, res: Response) => {
  try {

    res.render('expenseWrite.ejs');
  } catch (error) {
    console.log(error)
  }
});




//가계부 지출 내역 작성 api
router.post('/post', validateExpense, async (req: Request, res: Response) => {
  try {


    //document에 담아야할 내용들을 req.body에서 받기
    const { event, category, price, explanation, isFixed } = req.body;
    const date: Date = new Date(req.body.date);

    const { year }: { year: number } = { year: date.getFullYear() };
    const { month }: { month: number } = { month: date.getMonth() + 1 };
    const { day }: { day: number } = { day: date.getDate() };

    // date를 연 월 일로 쪼개기 


    const { userId, username } = req.user as UserPayLoad;
    console.log(req.user);
    //user 정보 받아서 넣기... 
    //req.user로 받기
    console.log(req.user);
    //고정 수입인지 확인
    const fix: boolean = (isFixed === 'on');
    //기본 인터페이스에게서 타입 받아오기
    const baseInfo: expenseInfo = {
      event,
      category,
      price: Number(price),
      explanation,
      isFixed: fix,
      moneyType: 'expense',
      year,
      month,
      day,
      userId,
      username
    };
    // fix의 bool타입에 의해서 타입 정하기
    const result: expenseInfo = baseInfo;
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
router.get('/list', requireAuth, async (req: Request, res: Response) => {
  try {
    let user = req.user as UserPayLoad;
    let result: expenseInfo[] = await db.collection<expenseInfo>('transection').find({
      userId: user.userId
      , moneyType: 'expense'
    }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);

    res.render('expenseList.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
    res.send(400);
  }
})




//고정 지출 내역 api
router.get('/fixedCost/list', requireAuth, async (req: Request, res: Response) => {
  try {
    let user = req.user as UserPayLoad;
    let result: expenseInfo[] = await db.collection<expenseInfo>('transection').find({ userId: user.userId, isFixed: true }).toArray();
    const total: number = result.reduce((sum, item) => sum + item.price, 0);
    res.render('expenseFixed.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
  }
})

//수정 화면 접속
router.get('/edit/:id', async (req: Request, res: Response) => {
  let documentId = req.params.id as string;

  let result = await db.collection<expenseInfo>('transection').findOne({
    _id: new ObjectId(documentId)
  })
  if (!result) {
    return res.send(404);
  }
  res.render('expenseEdit.ejs', { result: result });
})

//수정 put 요청
router.put('/edit/:id', async (req: Request, res: Response) => {
  //put 요청을 받아서
  //수정된 값을 수정하기

  let id: string = req.params.id as string;

  const { event, category, price, explanation, isFixed } = req.body;
  const date: Date = new Date(req.body.date);

  const { year }: { year: number } = { year: date.getFullYear() };
  const { month }: { month: number } = { month: date.getMonth() + 1 };
  const { day }: { day: number } = { day: date.getDate() };
  await db.collection<expenseInfo>('transection').updateOne({
    _id: new ObjectId(id)
  }, {
    $set: {
      category: category,
      price: price,
      event: event,
      explanation: explanation,
      isFixed: isFixed,
      year,
      month,
      day
    }
  })
  res.status(200).json({
    success: true,
    message: "저장 완료"
  });

})

//삭제 delete 요청 
router.delete('/delete/:id', async (req: Request, res: Response) => {
  try {
    let id: string = req.params.id as string;
    let result = await db.collection<expenseInfo>('transection').deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 1) {
      res.json({ success: true, message: '지출 내역이 삭제되었습니다.' });
    } else {
      // id에 해당하는 데이터가 DB에 존재하지 않았을 경우
      res.status(404).json({ success: false, message: '삭제할 지출 내역을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
})

// 메인 파일에서 가져다 쓸 수 있도록 내보내기
export default router;