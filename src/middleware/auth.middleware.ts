import  { Request, Response, NextFunction } from 'express';

const requireAuth = (req:Request,res:Response,next:NextFunction)=>{
    if(!req.user){
      return res.redirect('/login');
    }
    next();
}

export default requireAuth;