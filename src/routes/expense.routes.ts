import express, { Router, Request, Response } from 'express';
import { ObjectId, db } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import validateExpense from '../middleware/validation.middleware';
import { expenseInfo, regularData } from '../types/expenseInfo';
import { UserPayLoad } from '../types/user';
import { syncFixedExpenses } from '../middleware/expense.middleware';

const router: Router = express.Router();


// 일반 지출 쓰기 GET 요청 
router.get('/write', requireAuth, (req: Request, res: Response) => {
  try {
    const isFixed: boolean = Boolean(req.query.isFixed);
    console.log(isFixed);
    res.render('expenseWrite.ejs', { activeIsFixed: isFixed });
  } catch (error) {
    console.log(error);
  }
});





router.post('/post', requireAuth,validateExpense, async (req: Request, res: Response) => {
  try {
    const { event, category, price, explanation, isFixed,date } = req.body;
    
    const [year,month] = date.split('-').map(Number);
    
    const { userId, name } = req.user as UserPayLoad;
    const fix: boolean = isFixed === 'on';
    const result: expenseInfo = {
      event,
      category,
      price: Number(price),
      explanation,
      isFixed: fix,
      moneyType: 'expense',
      date,
      userId,
      name
    };
    const insertResult = await db.collection('transection').insertOne(result);

    if (fix) {
      const formattedMonth = String(month).padStart(2, '0');
      const fixedExpense: regularData = {
        original: insertResult.insertedId,
        lastUpdate: `${year}-${formattedMonth}`,
        expenseInfo: result,
        year,
        month,
        userId,
        name,
        createdAt: new Date()
      };

      await db.collection('regular').insertOne(fixedExpense);
      await syncFixedExpenses(userId);
    }

    res.status(200).json({ success: true, message: '저장 완료' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '서버 오류' });
  }
});





router.get('/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const result = await db.collection<expenseInfo>('transection').find({
      userId: user.userId,
      moneyType: 'expense'
    }).toArray();
    const total = result.reduce((sum, item) => sum + item.price, 0);

    res.render('expenseList.ejs', { items: result, total });
  } catch (error) {
    console.log(error);
    res.send(400);
  }
});





router.get('/edit/:id', requireAuth, async (req: Request, res: Response) => {
  const documentId = req.params.id as string;
  const user = req.user as UserPayLoad;
  const result = await db.collection<expenseInfo>('transection').findOne({
    _id: new ObjectId(documentId),
    userId: user.userId
  });

  if (!result) {
    return res.send(404);
  }

  res.render('expenseEdit.ejs', { result, url: '' });
});





router.put('/edit/:id', requireAuth, validateExpense, async (req: Request, res: Response) => {
  const user = req.user as UserPayLoad;
  const id = req.params.id as string;
  const { event, category, price, explanation, isFixed,date } = req.body;
  
  

  await db.collection<expenseInfo>('transection').updateOne(
    { _id: new ObjectId(id), userId: user.userId },
    {
      $set: {
        category,
        price,
        event,
        explanation,
        isFixed,
        date
      }
    }
  );

  res.status(200).json({ success: true, message: '저장 완료' });
});





router.delete('/delete/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await db.collection<expenseInfo>('transection').deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 1) {
      res.json({ success: true, message: '지출 내역이 삭제되었습니다.' });
    } else {
      res.status(404).json({ success: false, message: '삭제할 지출 내역을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
});






export default router;
