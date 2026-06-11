import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
import FeedsRouter from './feed.route.js';
import FeedsAdminRouter from './admin.routes.js';

const FeedsIndexRouter = express.Router();

// Mount PromoRouter under UserRouter
FeedsIndexRouter.use('/', FeedsRouter);
FeedsIndexRouter.use('/admin', FeedsAdminRouter);

export default FeedsIndexRouter;