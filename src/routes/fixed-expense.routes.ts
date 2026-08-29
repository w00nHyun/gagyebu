import { Router, Request, Response } from 'express';
import { ObjectId, db } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { regularData } from '../types/expenseInfo';
import { UserPayLoad } from '../types/user';

const router = Router();

router.get('/fixedCost/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const result = await db.collection<regularData>('regular').find({
      userId: user.userId
    }).toArray();
    const total = result.reduce((sum, item) => sum + item.expenseInfo.price, 0);

    res.render('expenseFixed.ejs', { items: result, total });
  } catch (error) {
    console.log(error);
  }
});

router.get('/edit/regular/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id as string;
    const user = req.user as UserPayLoad;
    const result = await db.collection<regularData>('regular').findOne({
      userId: user.userId,
      _id: new ObjectId(documentId)
    });

    if (!result) {
      return res.send(404);
    }

    res.render('expenseEdit.ejs', { result: result.expenseInfo, url: result._id });
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 오류');
  }
});

router.put('/edit/regular/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id as string;
    const user = req.user as UserPayLoad;
    const { event, category, price, explanation } = req.body;
    const date: Date = new Date(req.body.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const result = await db.collection('regular').updateOne(
      { _id: new ObjectId(documentId), userId: user.userId },
      {
        $set: {
          'expenseInfo.event': event,
          'expenseInfo.category': category,
          'expenseInfo.price': price,
          'expenseInfo.explantion': explanation,
          'expenseInfo.year': year,
          'expenseInfo.month': month,
          'expenseInfo.day': day
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: '수정할 대상을 찾을 수 없습니다.' });
    }

    if (result.modifiedCount === 0) {
      return res.json({ success: true, message: '변경된 내용이 없습니다.' });
    }

    res.status(200).json({ success: true, message: '저장 완료' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: '수정처리 중 서버 오류' });
  }
});

router.delete('/delete/regular/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id as string;
    const user = req.user as UserPayLoad;
    const result = await db.collection<regularData>('regular').deleteOne({
      userId: user.userId,
      _id: new ObjectId(documentId)
    });

    if (result.deletedCount === 1) {
      res.status(200).json({ success: true, message: '지출 내역이 삭제되었습니다.' });
    } else {
      res.status(404).json({ success: false, message: '삭제할 지출 내역을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
});

export default router;
