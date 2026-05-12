// store.routes.js
import express from 'express';
import { storeController } from '../../controllers/store/promoter-store-list.controller.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

// Public/authenticated routes for promoters
router.get('/stores',
  storeController.getStoresForPromoter
);

// router.get('/:storeId',
//   storeController.getStoreDetails
// );

// router.get('/:storeId/products',
//   storeController.getStoreProducts
// );

// Follow routes
router.post('/:storeId/follow',
  storeController.toggleFollowStore
);

router.get('/followed/stores',
  storeController.getFollowedStores
);

export default router;
