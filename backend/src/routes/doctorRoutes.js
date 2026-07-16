import express from 'express';
import { getDoctors, getDoctorById, getDoctorSlots } from '../controllers/doctorController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes for searching and viewing profiles
router.get('/', getDoctors);
router.get('/:id', getDoctorById);

// Protected routes
router.get('/:id/slots', protect, getDoctorSlots);

export default router;