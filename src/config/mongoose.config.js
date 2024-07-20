import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config();

export default async function connectToMongoose() {
    await mongoose.connect(process.env.API_URL);
    console.log('connected to database.')
}