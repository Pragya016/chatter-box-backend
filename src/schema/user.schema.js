import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique : true,
        match: [/.+@.+\..+/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: true
    }
});

export const User = mongoose.model('User', userSchema);
