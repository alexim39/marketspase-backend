import express from 'express';
import { 
    toggleNotification,
} from '../controllers/notification.controller.js'


const NotificationRouter = express.Router();

// toggle notification settings
NotificationRouter.post('/', toggleNotification);



export default NotificationRouter;