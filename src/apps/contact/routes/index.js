import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import IndexRouter from './contact.route.js';

const ContactRouter = express.Router();

// Mount IndexRouter under ContactRouter
ContactRouter.use('/', IndexRouter);

export default ContactRouter;