import express, { Router, Request, Response, NextFunction } from 'express';
import { ObjectId, db } from '../config/database';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import validateExpense from '../middleware/validation.middleware';
import { expenseInfo, regularData } from '../types/expenseInfo';
import { User, UserPayLoad } from '../types/user';
import { syncFixedExpenses } from '../middleware/expense.middleware';
const router: Router = express.Router();






router.get('/write', requireAuth, (req: Request, res: Response) => {
  try {
    const isFixed : boolean = Boolean(req.query.isFixed);
    console.log(isFixed);
    res.render('expenseWrite.ejs',{activeIsFixed : isFixed});
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


    const { userId, name } = req.user as UserPayLoad;

    //user 정보 받아서 넣기... 
    //req.user로 받기


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
      name
    };

    // fix의 bool타입에 의해서 타입 정하기
    const result: expenseInfo = baseInfo;
    const insertResult = await db.collection('transection').insertOne(result);
    if (fix) {
      // 💡 year, month를 'YYYY-MM' 형식의 문자열로 안전하게 생성 (예: '2026-08')
      const formattedMonth: string = String(month).padStart(2, '0');
      const lastUpdate: string = `${year}-${formattedMonth}`;

      const regularData: regularData = {
        original: insertResult.insertedId, // 원본 transection의 _id
        lastUpdate: lastUpdate,
        expenseInfo: result,            // 최근 업데이트/적용 연월 (예: '2026-08')
        year,                               // 숫자 연도도 필요시 포함
        month,                              // 숫자 월도 필요시 포함
        userId,
        name,
        createdAt: new Date()
      };
      await db.collection('regular').insertOne(regularData);
      await syncFixedExpenses(userId);
    }

    res.status(200).json({
      success: true,
      message: "저장 완료"
    });

  }
  catch (error) {
    console.log(error);
    res.status(500).json({ message: '서버 오류' });
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
    let result: regularData[] = await db.collection<regularData>('regular').find({ userId: user.userId }).toArray();
    console.log(result);
    const total: number = result.reduce((sum, item) => sum + item.expenseInfo.price, 0);
    res.render('expenseFixed.ejs', { items: result, total: total });
  } catch (error) {
    console.log(error)
  }
})

//고정 지출 수정 api 
router.get('/edit/regular/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    let regularDocumentId = req.params.id as string;
    let user = req.user as UserPayLoad;
    let result = await db.collection<regularData>('regular').findOne({ userId: user.userId, _id: new ObjectId(regularDocumentId) });
    if (!result) {
      return res.send(404);
    }
    res.render('expenseEdit.ejs', { result: result.expenseInfo,url : result._id })
  } catch (err) {
    console.log(err);
    res.status(500).send('서버 오류');
  }

})
//고정 지출 수정 POST api
router.put('/edit/regular/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    //변경될 expenseInfo
    const documentId = req.params.id as string;
    console.log(documentId);
    const user = req.user as UserPayLoad;
    const { event, category, price, explanation, isFixed } = req.body;
    const date: Date = new Date(req.body.date);
   
    const { year }: { year: number } = { year: date.getFullYear() };
    const { month }: { month: number } = { month: date.getMonth() + 1 };
    const { day }: { day: number } = { day: date.getDate() };
    let result2 =await db.collection('regular').findOne({_id : new ObjectId(documentId),userId : user.userId});


    let result =await db.collection('regular').updateOne({_id :new ObjectId(documentId),userId : user.userId},{
      $set : {
        'expenseInfo.event' : event,
        'expenseInfo.category' : category,
        'expenseInfo.price' : price,
        'expenseInfo.explantion' : explanation,
        'expenseInfo.year' : year,
        'expenseInfo.month' : month,
        'expenseInfo.day' : day,
      }
    })
    if (result.matchedCount === 0) {
  return res.status(404).json({ success: false, message: '수정할 대상을 찾을 수 없습니다.' });
}

// 2. 매칭은 되었으나 실제로 수정된 내용이 없는 경우 (선택적 처리)
if (result.modifiedCount === 0) {
  // 기존과 동일한 데이터로 요청이 왔을 때
  return res.json({ success: true, message: '변경된 내용이 없습니다.' });
}
    res.status(200).json({
    success: true,
    message: "저장 완료"
  });
  } catch (err) {
    console.log(err);
    res.status(500).json({success : false, message : '수정처리 중 서버 오류'});
  }
})
//고정지출 삭제 api
router.delete('/delete/regular/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    let regularDocumentId = req.params.id as string;
    let user = req.user as UserPayLoad;
    let result = await db.collection<regularData>('regular').deleteOne({ userId: user.userId, _id: new ObjectId(regularDocumentId) });
    if (result.deletedCount === 1) {
      res.status(200).json({ success: true, message: '지출 내역이 삭제되었습니다.' });
    }
    else {
      res.status(404).json({ success: false, message: '삭제할 지출 내역을 찾을 수 없습니다.' })
    }

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
})



//수정 화면 접속
router.get('/edit/:id', requireAuth, async (req: Request, res: Response) => {
  let documentId = req.params.id as string;
  let user = req.user as UserPayLoad
  let result = await db.collection<expenseInfo>('transection').findOne({
    _id: new ObjectId(documentId),
    userId: user.userId
  })
  if (!result) {
    return res.send(404);
  }
  res.render('expenseEdit.ejs', { result: result });
})


//수정 put 요청
router.put('/edit/:id', requireAuth, async (req: Request, res: Response) => {
  //put 요청을 받아서
  //수정된 값을 수정하기
  let user = req.user as UserPayLoad
  let id: string = req.params.id as string;

  const { event, category, price, explanation, isFixed } = req.body;
  const date: Date = new Date(req.body.date);

  const { year }: { year: number } = { year: date.getFullYear() };
  const { month }: { month: number } = { month: date.getMonth() + 1 };
  const { day }: { day: number } = { day: date.getDate() };
  await db.collection<expenseInfo>('transection').updateOne({
    _id: new ObjectId(id),
    userId: user.userId
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