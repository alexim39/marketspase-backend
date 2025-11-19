import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware


import AdminNewsletterRouter from './newsletter.route.js';



const NewsletterRouter = express.Router();

// Mount PromoRouter under UserRouter
NewsletterRouter.use('/admin', AdminNewsletterRouter);



export default NewsletterRouter;