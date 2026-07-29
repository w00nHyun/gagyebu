import  { Request, Response, NextFunction } from 'express';

//middleWare (유효성 검사)
const validateExpense = (req: Request, res: Response, next: NextFunction) => {
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

export default validateExpense;