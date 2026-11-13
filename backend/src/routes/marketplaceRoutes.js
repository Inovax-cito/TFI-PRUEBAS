import { Router } from 'express';
import {
  adminListApplications, createEvent, getBusinessProfile, getEvent, getEventActivity,
  listApplications, listEvents, saveApplication, saveBusinessProfile,
  setApplicationStatus, updateEvent,
} from '../controllers/marketplaceController.js';
import { authenticateToken, requireEntrepreneur, requireOrganizer } from '../middlewares/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/business', requireEntrepreneur, getBusinessProfile);
router.put('/business', requireEntrepreneur, saveBusinessProfile);
router.get('/events', listEvents);
router.get('/events/:id/activity', getEventActivity);
router.get('/events/:id', getEvent);
router.post('/events', requireOrganizer, createEvent);
router.put('/events/:id', requireOrganizer, updateEvent);
router.get('/applications', requireEntrepreneur, listApplications);
router.post('/events/:eventId/applications', requireEntrepreneur, saveApplication);
router.get('/admin/applications', requireOrganizer, adminListApplications);
router.patch('/admin/applications/:id/status', requireOrganizer, setApplicationStatus);

export default router;
