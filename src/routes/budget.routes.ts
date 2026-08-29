import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { UserPayLoad } from '../types/user';

const router = Router();

interface BudgetPlan extends UserPayLoad {
  planType: 'annual' | 'monthly';
  budget: number;
}

router.get('/budget', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const monthlyResult = await db.collection('plan').findOne(
      { userId: user.userId, planType: 'monthly' },
      { sort: { updatedAt: -1 } }
    );
    const annualResult = await db.collection('plan').findOne(
      { userId: user.userId, planType: 'annual' },
      { sort: { updatedAt: -1 } }
    );
    const monthlyUsedAgg = await db.collection('transection').aggregate([
      { $match: { userId: user.userId, year, month: Number(month) } },
      { $group: { _id: null, used: { $sum: '$price' } } }
    ]).toArray();
    const annualUsedAgg = await db.collection('transection').aggregate([
      { $match: { userId: user.userId, year } },
      { $group: { _id: null, used: { $sum: '$price' } } }
    ]).toArray();

    const budgetData = {
      monthlyAmount: monthlyResult?.budget ?? null,
      monthlyUsedAmount: monthlyUsedAgg[0]?.used ?? 0,
      annualAmount: annualResult?.budget ?? null,
      annualUsedAmount: annualUsedAgg[0]?.used ?? 0
    };

    res.render('budget.ejs', { budgetData });
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});

router.get('/budget/plan', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const monthlyResult = await db.collection('plan').findOne(
      { userId: user.userId, planType: 'monthly' },
      { sort: { updatedAt: -1 } }
    );
    const annualResult = await db.collection('plan').findOne(
      { userId: user.userId, planType: 'annual' },
      { sort: { updatedAt: -1 } }
    );

    const budgetData = {
      monthlyAmount: monthlyResult?.budget ?? null,
      monthlyPeriod: `${year}-${month}`,
      monthlyUsedAmount: 0,
      annualAmount: annualResult?.budget ?? null,
      annualPeriod: `${year}`,
      annualUsedAmount: 0
    };
    const activeTab = req.query.tab === 'annual' ? 'annual' : 'monthly';

    res.render('budgetPlan.ejs', { budgetData, activeTab });
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});

router.put('/plan/budget/save', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const { planType } = req.body;
    const budget = Number(req.body.budget);
    const result: BudgetPlan = {
      planType,
      budget,
      name: user.name,
      userId: user.userId
    };

    await db.collection('plan').updateOne(
      { userId: user.userId, planType },
      { $set: { budget: result.budget, username: user.name, updatedAt: new Date() } },
      { upsert: true }
    );

    return res.redirect('/budget');
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});

router.post('/plan/budget/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const { planType } = req.body;

    if (!['monthly', 'annual'].includes(planType)) {
      return res.status(400).send('유효하지 않은 예산 종류입니다.');
    }

    await db.collection('plan').deleteOne({ userId: user.userId, planType });
    return res.redirect('/budget');
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});

export default router;
