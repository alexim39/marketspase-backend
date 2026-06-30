import express from 'express';
const StoreIndexRouter = express.Router();
import StoreRouter from './store/store.route.js';
import ProductRouter from './product/product.routes.js';
import StorefrontRouter from './storefront/storefront.routes.js';
import AdminfrontRouter from './admin/store.routes.js';
import PromoterCollectionsRouter from './product/promotion/promoter-collections.routes.js';
import ServiceRouter from './service/service.routes.js';


// Mount store routes
StoreIndexRouter.use('/store', StoreRouter);

// Mount product routes
StoreIndexRouter.use('/product', ProductRouter);

// Mount storefront routes
StoreIndexRouter.use('/storefront', StorefrontRouter);

// Mount admin routes
StoreIndexRouter.use('/admin', AdminfrontRouter);

// Mount promoter collections routes
StoreIndexRouter.use('/promoter/collections', PromoterCollectionsRouter);

StoreIndexRouter.use('/service', ServiceRouter);

export default StoreIndexRouter;