import express from 'express';
const StoreIndexRouter = express.Router();
import StoreRouter from './store.route.js';


// Mount store routes
StoreIndexRouter.use('/', StoreRouter);

export default StoreIndexRouter;