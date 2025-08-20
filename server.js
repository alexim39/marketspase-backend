import express from 'express';
import mongoose from 'mongoose';
import dotenv  from "dotenv"
import cors from 'cors';
import cookieParser from 'cookie-parser';


import path from 'path';

import AuthRouter from './src/apps/auth/index.js';
import UserRouter from './src/apps/user/index.js';
import WalletRouter from './src/apps/wallet/index.js';
//import ContactRouter from './src/apps/contact/index.js';
//import TransactionRouter from './src/apps/transaction/index.js';


const port = process.env.PORT || 8080;
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
dotenv.config()
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: [
        'http://localhost:4200', 
        'https://marketspase.com', 
        'http://marketspase.com',
        'www.marketspase.com',
    ]
}));

/* Routes */
app.get('/', (req, res) => res.send('Node server is up and running'));
app.use('/auth', AuthRouter);
app.use('/user', UserRouter);
app.use('/wallet', WalletRouter);
//app.use('/contact', ContactRouter);
//app.use('/transaction', TransactionRouter);

// Serve static files
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

/* DB connection */
mongoose.connect(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`)
.then(() => {
    // Application Starts Only when MongoDB is connected
    console.log('Connected to mongoDB')
    app.listen(port, () => {
        console.log(`Server is running on port: http://localhost:${port}`)
    })
}).catch((error) => {
    console.error('Error from mongoDB connection ', error)
})