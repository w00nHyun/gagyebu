import express, { Application, NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/database';
import { configPassport } from './config/passport';
import authRouter from './routes/auth.routes';
import expenseRouter from './routes/expense.routes';
import fixedExpenseRouter from './routes/fixed-expense.routes';
import budgetRouter from './routes/budget.routes';
import statisticsRouter from './routes/statistics.routes';
import calendarRouter from './routes/calendar.routes';

dotenv.config();

const app: Application = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.json());
app.use(cookieParser());

configPassport();
app.use(passport.initialize());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.user = null;
  const token = req.cookies?.token;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    );

    req.user = decoded;
    res.locals.user = decoded;
  } catch (error) {
    res.clearCookie('token');
  }

  next();
});

app.set('view engine', 'ejs');

app.get('/', (req: Request, res: Response) => {
  try {
    res.render('home.ejs');
  } catch (error) {
    console.log(error);
    res.status(500).send('서버 에러');
  }
});

app.use('/', authRouter);
app.use('/expense', expenseRouter);
app.use('/expense', fixedExpenseRouter);
app.use('/', budgetRouter);
app.use('/', statisticsRouter);
app.use('/', calendarRouter);

const PORT = Number(process.env.PORT) || 8080;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 연결 성공`);
  });
});
