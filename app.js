import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import connectToMongoose from './src/config/mongoose.config.js';
import { User } from './src/schema/user.schema.js';
import { Chat } from './src/schema/chat.schema.js';

dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 200,
        credentials: true 
    }
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
    credentials: true
}));

app.get('/', (req, res) => {
    res.send('Hello from server');
});

// Handle socket connection
io.on('connection', (socket) => {
    // when user register on app
    socket.on('register', async (credentials) => {
        if (credentials.password !== credentials.confirmPassword) {
            socket.emit('registerationFailure', { message: "Passwords don't match." });
            return;
        }

        try {
            const user = await User.findOne({ email: credentials.email });

            if (user) {
                socket.emit('duplicate_email', { message: 'This email is already registered.' });
                return;
            }
            const newUser = new User({
                name: credentials.name,
                email: credentials.email,
                password: credentials.password
            });

            await newUser.save();
            socket.emit('registeration_successful', credentials.name)
        } catch (error) {
            console.error('Error registering user:', error.message);
            socket.emit('registerationFailure', { message: 'Registration failed' });
        }
    });

    // when user login to the application
    socket.on('login', async (credentials) => {
        try {
            const user = await User.findOne({ email: credentials.email })

            if (!user) {
                socket.emit('loginFailure', { message: "Username or password is incorrect." })
                return;
            }

            if (user.email === credentials.email && user.password === credentials.password) {
                const token = jwt.sign({ email: user.email }, process.env.SECRET_KEY, { expiresIn: '7d' });
                socket.emit('login_successful', token);
            } else {
                socket.emit('loginFailure', { message: "Username or password is incorrect." })
            }
        } catch (error) {
            console.log(error)
            socket.emit('loginFailure', { message: "Something went wrong! Please try again later." })
        }
    });

    // double check the token when the homepage loads
    socket.on('verify_token', token => {
        jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
            if (err) {
                socket.emit('unauthenticated');
            } else {
                socket.emit('authenticated');
            }
        });
    })

    // when user joins the chat, broadcast message to other users
    socket.on('new_user_connected', async (data) => {
        try {
            if (data.name === null) {
                const user = await User.findOne({ email : data.email })
                data.name = user.name;
            }

            const date = new Date();
            const formattedHours = date.getHours() % 12 || 12;
            const formattedMinutes = String(date.getMinutes()).padStart(2, '0');
            const period = date.getHours() >= 12 ? 'PM' : 'AM';
            const curTime = `${formattedHours}:${formattedMinutes} ${period}`;

            const newChat = new Chat({
                name: data.name,
                email: data.email,
                message: data.message,
                timestamp: curTime,
            });

            await newChat.save();
            socket.broadcast.emit('notify', data.name);
            socket.emit('greet', data.name);
        } catch (err) {
            console.error('Error:', err);
        }
    });



    // when user will create a new group
    socket.on('group_creation', (res) => {
        if (!res || !res.title) {
            socket.emit('group_addition_failure', { message: 'Something went wrong.' })
        }
    })

    // when user will be typing a message
    socket.on('typing', () => {
        socket.broadcast.emit('typing')
    })

    // when user sends a message
    socket.on('send_message', async (data) => {
        try {
            if (!data.email) {
                socket.emit('invalid_user', { message: 'User is not valid' });
            }
            
            const user = await User.findOne({ email: data.email });

            if (!user) {
                socket.emit('invalid_user', { message: 'User is not valid' });
                return;
            }

            const chat = new Chat({
                name : user.name,
                email: user.email,
                message: data.message,
                timestamp : data.time
            })

            await chat.save();
            socket.broadcast.emit('broadcast_message', { name: user.name, message: data.message, timestamp : data.time});
        } catch (error) {
            console.error('Error handling send_message event:', error);
        }
    });
    // when homepage loads
    socket.on('load_home', async () => {
        const users = await User.find();
        socket.emit('load_users', users)
    })

    socket.on('load_chats', async() => {
        const chats = await Chat.find();
        socket.emit('load_previous_chats', chats)
    })

    socket.on('logout', async(email) => {
        try {
            const user = await User.findOne({ email: email })

            if (!user) {
                socket.emit('logout_failure', { message: "Something went wrong! Please try again after some time." });
            }
            socket.emit('logout_successful');
            socket.broadcast.emit('user_disconnect', user.name)
        } catch (error) {
            console.log(error);
            socket.emit('logout_failure', { message: "Something went wrong! Please try again after some time." });
        }
    })
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    connectToMongoose();
    console.log(`Server running on port ${ PORT }`);
});