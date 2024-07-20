import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    name : String,
    email: String,
    message: String,
    timestamp: String
})

export const Chat = mongoose.model('Chat', chatSchema);