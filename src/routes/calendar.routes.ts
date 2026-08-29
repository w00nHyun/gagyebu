import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { UserPayLoad } from '../types/user';

const router = Router();

router.get('/calendar', requireAuth, (req: Request, res: Response) => {
  try {
    res.render('calendar.ejs');
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});




router.get('/calendar/data', requireAuth, async (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      return res.status(400).json({ message: 'from 및 to 쿼리 파라미터를 모두 전달해주세요.' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        message: '올바른 날짜 형식이 아닙니다. (예: YYYY-MM-DD)'
      });
    }

    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);

    if (
      fromYear > toYear ||
      (fromYear === toYear && fromMonth > toMonth) ||
      (fromYear === toYear && fromMonth === toMonth && fromDay > toDay)
    ) {
      return res.status(400).json({ message: '쿼리파라미터 기간 유효성 오류' });
    }

    const user = req.user as UserPayLoad;

    const rawItems = await db.collection('transection').find({
      userId: user.userId,
      date: {
        $gte: from,
        $lte: to
      }
    }).sort({ date: 1 }).toArray();

    type CalendarDay = {
      date: string;
      year: number;
      month: number;
      day: number;
      items: any[];
      incomeTotal: number;
      expenseTotal: number;
    };

    const days: CalendarDay[] = [];
    const dayMap: Record<string, CalendarDay> = {};
    const pad = (value: number) => String(value).padStart(2, '0');
    const formatDate = (year: number, month: number, day: number) =>
      `${year}-${pad(month)}-${pad(day)}`;

    for (
      let date = new Date(fromYear, fromMonth - 1, fromDay);
      date <= new Date(toYear, toMonth - 1, toDay);
      date.setDate(date.getDate() + 1)
    ) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dateString = formatDate(year, month, day);
      const entry: CalendarDay = {
        date: dateString,
        year,
        month,
        day,
        items: [],
        incomeTotal: 0,
        expenseTotal: 0
      };

      days.push(entry);
      dayMap[dateString] = entry;
    }

    rawItems.forEach((item: any) => {
      const entry = dayMap[item.date];
      if (!entry) return;

      const amount = Number(item.price) || 0;
      entry.items.push(item);

      if ((item.moneyType || 'expense') === 'income') {
        entry.incomeTotal += amount;
      } else {
        entry.expenseTotal += amount;
      }
    });

    const summary = days.reduce(
      (result, day) => {
        result.totalIncome += day.incomeTotal;
        result.totalExpense += day.expenseTotal;
        return result;
      },
      { totalIncome: 0, totalExpense: 0 }
    );

    return res.json({ startDate: from, endDate: to, days, summary });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '서버 에러' });
  }
});

export default router;
