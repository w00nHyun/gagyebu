import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { UserPayLoad } from '../types/user';

const router = Router();

interface GroupStat<T> {
  _id: T;
  total: number;
}

const fixEval = (fixStat: GroupStat<boolean>[]): number[] => {
  const ret: number[] = [0, 0];

  fixStat.forEach(element => {
    if (element._id) {
      ret[0] = element.total;
    } else {
      ret[1] = element.total;
    }
  });

  return ret;
};

const mapStatsToLabels = (
  statsArray: { _id: string; total: number }[],
  labels: string[]
): number[] => {
  const statsMap: Record<string, number> = {};

  statsArray.forEach(item => {
    if (item._id !== null && item._id !== undefined) {
      statsMap[String(item._id)] = item.total;
    }
  });

  return labels.map(label => statsMap[label] || 0);
};

router.get('/stat', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayLoad;
    const categoryLabel = ['식비', '교통비', '주거/통신', '문화/여가', '구독비', '쇼핑비', '병원비', '기타'];
    const eventLabel = ['개인지출', '친구', '데이트', '지인', '가족', '비즈니스', '기타이벤트'];
    const [stats] = await db.collection('transection').aggregate([
      { $match: { userId: user.userId } },
      {
        $facet: {
          categoryStats: [
            { $group: { _id: '$category', total: { $sum: '$price' } } }
          ],
          eventStats: [
            { $group: { _id: '$event', total: { $sum: '$price' } } }
          ],
          fixedStats: [
            { $group: { _id: '$isFixed', total: { $sum: '$price' } } }
          ]
        }
      }
    ]).toArray();

    const chartData = {
      fixData: fixEval(stats.fixedStats),
      categoryData: mapStatsToLabels(stats.categoryStats, categoryLabel),
      eventData: mapStatsToLabels(stats.eventStats, eventLabel),
      categoryLabel,
      eventLabel
    };

    res.render('expenseChart.ejs', { chartData });
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});

export default router;
