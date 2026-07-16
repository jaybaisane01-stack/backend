import express from 'express';
import { createAppointment, getAppointments } from '../controllers/appointmentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All appointment routes require authentication
router.use(protect);

router.post('/', authorize('PATIENT', 'RECEPTIONIST', 'SUPER_ADMIN'), createAppointment);
router.get('/', getAppointments);

export default router;