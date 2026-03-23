import express from 'express';
const StoreIndexRouter = express.Router();
import StoreRouter from './store/store.route.js';
import ProductRouter from './product/product.routes.js';
import StorefrontRouter from './storefront/storefront.routes.js';
import AdminfrontRouter from './admin/store.routes.js';


// Mount store routes
StoreIndexRouter.use('/store', StoreRouter);

// Mount product routes
StoreIndexRouter.use('/product', ProductRouter);

// Mount storefront routes
StoreIndexRouter.use('/storefront', StorefrontRouter);

// Mount admin routes
StoreIndexRouter.use('/admin', AdminfrontRouter);

export default StoreIndexRouter;