import { Router } from 'express';

import { register, login, logout, me, updateMe, changeMyPassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, updateMe);
router.patch('/me/password', authenticate, changeMyPassword);

export default router;
