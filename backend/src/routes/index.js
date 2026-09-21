import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import eventRoutes from './event.routes.js';
import planningRoutes from './planning.routes.js';
import registrationRoutes from './registration.routes.js';
import certificateRoutes from './certificate.routes.js';
import notificationRoutes from './notification.routes.js';
import roleTestRoutes from './roleTest.routes.js';

/**
 * Root API router. All feature routers are mounted here under /api
 * (see src/app.js).
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Admin module (Phase 2 + Phase 3 event oversight): /api/admin/*
router.use('/admin', adminRoutes);

// Event module (Phase 3): /api/events/* — organiser-owned event CRUD.
// Mounted before planning so /events/my, /events/:id etc. resolve here first;
// planning routes match the two-segment /events/:eventId/<resource> shape.
router.use('/events', eventRoutes);

// Pre-event planning (Phase 4): /api/events/:eventId/{tasks,schedule,resources,budget,team,planning/*}
router.use('/events/:eventId', planningRoutes);

// Participant registration (Phase 6): /api/registrations/{mine, :id/cancel, :id/qr}
router.use('/registrations', registrationRoutes);

// Certificates (Phase 8): /api/certificates/{verify/:code (public), mine, :id/download}
router.use('/certificates', certificateRoutes);

// Notifications (Phase 8): /api/notifications/{'', unread-count, read-all, :id/read}
router.use('/notifications', notificationRoutes);

// Phase 1 RBAC test endpoints: /api/admin/test, /api/organiser/test, /api/user/test
// (mounted after adminRoutes — falls through to here since adminRoutes has no /test route)
router.use('/', roleTestRoutes);

export default router;
