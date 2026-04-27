import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import IndexRouter from './tutorial.routes.js';

const TutorialIndexRouter = express.Router();

// Mount IndexRouter under TutorialIndexRouter
TutorialIndexRouter.use('/', IndexRouter);

export default TutorialIndexRouter;