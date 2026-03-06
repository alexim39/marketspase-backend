import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
import FeedsRouter from './feed.route.js';

const FeedsIndexRouter = express.Router();

// Mount PromoRouter under UserRouter
FeedsIndexRouter.use('/', FeedsRouter);

export default FeedsIndexRouter;