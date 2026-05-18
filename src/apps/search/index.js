import express from 'express';
import searchRoutes from './routes/search.routes.js';

const SearchRouter = express.Router();

SearchRouter.use('/', searchRoutes);

export default SearchRouter;
