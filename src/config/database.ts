import { MongoClient, Db, ObjectId } from 'mongodb'; // 1. ObjectId 가져오기
import dotenv from 'dotenv';

dotenv.config();

const url: string | undefined = process.env.MONGODB_URI;
if (typeof url === 'undefined') {
  console.error("환경변수 MONGODB_URI가 설정되지 않았습니다.");
  process.exit(1);
}
const client = new MongoClient(url);
const dbName = 'gagyebu';
let db: Db;

async function connectDB(): Promise<void> {
  try {
    await client.connect();
    console.log('MongoDB 공식 드라이버로 연결 성공!');

    // client.db()는 확실하게 Db 인스턴스를 반환하므로 미리 정의한 db 변수에 대입합니다.
    db = client.db(dbName);
  } catch (error) {
    console.error('MongoDB 연결 실패:', error);
    process.exit(1);
  }
}
// 2. db 객체와 ObjectId를 함께 export!
export { db, connectDB,ObjectId };

