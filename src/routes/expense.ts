import express, { Router, Request, Response } from 'express';

const router: Router = express.Router();

type expenseInfo={
  event : string,
  category : string,
  price : number,
  date : string,
  explanation  : string
}

router.get('/write', (req: Request, res: Response) => {
  res.render('expenseWrite.ejs');
});

router.post('/post',async(req:Request,res : Response)=>{
  console.log(req.body);
  
})
// 메인 파일에서 가져다 쓸 수 있도록 내보내기
export default router;