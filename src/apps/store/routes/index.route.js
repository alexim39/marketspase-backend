import express from 'express';
const StoreIndexRouter = express.Router();
import StoreRouter from './store.route.js';
import ProductRouter from './product.routes.js';


// Mount store routes
StoreIndexRouter.use('/', StoreRouter);

// Mount product routes
StoreIndexRouter.use('/product', ProductRouter);

export default StoreIndexRouter;