import express from 'express';
const StoreIndexRouter = express.Router();
import StoreRouter from './store.route.js';
import ProductRouter from './product.routes.js';
import StorefrontRouter from './storefront.routes.js';


// Mount store routes
StoreIndexRouter.use('/', StoreRouter);

// Mount product routes
StoreIndexRouter.use('/product', ProductRouter);

// Mount storefront routes
StoreIndexRouter.use('/storefront', StorefrontRouter);

export default StoreIndexRouter;