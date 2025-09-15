import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
import PromotionRouter from './routes/promotion.route.js';
export default PromotionRouter;