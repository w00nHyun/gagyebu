import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DB_URL || '';
const connectDB = new MongoClient(url).connect();

export default connectDB;