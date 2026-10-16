import { Router } from 'express';
import {
  adminListApplications, createEvent, getBusinessProfile, getEvent, getEventActivity,
  listApplications, listEvents, saveApplication, saveBusinessProfile,
  setApplicationStatus, updateEvent,
} from '../controllers/marketplaceController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/business', getBusinessProfile);
router.put('/business', saveBusinessProfile);
router.get('/events', listEvents);
router.get('/events/:id/activity', getEventActivity);
router.get('/events/:id', getEvent);
router.post('/events', requireAdmin, createEvent);
router.put('/events/:id', requireAdmin, updateEvent);
router.get('/applications', listApplications);
router.post('/events/:eventId/applications', saveApplication);
router.get('/admin/applications', requireAdmin, adminListApplications);
router.patch('/admin/applications/:id/status', requireAdmin, setApplicationStatus);

export default router;
