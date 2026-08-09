import { ObjectId } from 'mongodb';
import { UserPayLoad } from './user'; 

export interface expenseInfo extends UserPayLoad {
 _id?: ObjectId | undefined;
  event: string,
  category: string,
  price: number,
  explanation: string,
  isFixed: boolean,
  moneyType: 'expense',
  year: number,
  month: number,
  day: number
}


export interface regularData  {
        original: ObjectId, // 원본 transection의 _id
        lastUpdate: string,             // 최근 업데이트/적용 연월 (예: '2026-08')
        expenseInfo : expenseInfo,
        year : number,                        // 숫자 연도도 필요시 포함
        month : number,                              // 숫자 월도 필요시 포함
        userId : string,
        name : string,
        createdAt: Date
      };