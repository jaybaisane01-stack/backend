import { prisma } from '../config/db.js';

/**
 * @desc    Book a new appointment
 * @route   POST /api/v1/appointments
 * @access  Protected (Patient, Receptionist)
 */
export const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, date, startTime, endTime, reason } = req.body;
    const patientId = req.user.id; // From Auth Middleware

    // 1. Verify Doctor exists and is active
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      res.status(404);
      throw new Error('Doctor not found');
    }

    // 2. Prevent Booking Past Dates
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to midnight
    
    if (bookingDate < today) {
      res.status(400);
      throw new Error('Cannot book appointments in the past');
    }

    // 3. Double-Booking Check (Concurrency safeguard)
    const existingBooking = await prisma.appointment.findFirst({
      where: {
        doctorId,
        date: new Date(date),
        startTime,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (existingBooking) {
      res.status(409); // Conflict
      throw new Error('This time slot has already been booked. Please select another.');
    }

    // 4. Create Transaction (Appointment + Notification)
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId,
          doctorId,
          date: new Date(date),
          startTime,
          endTime,
          reason,
          status: 'CONFIRMED', // Auto-confirming for MVP, can be PENDING based on rules
        },
      });

      // Notify Patient
      await tx.notification.create({
        data: {
          userId: patientId,
          appointmentId: appointment.id,
          title: 'Appointment Confirmed',
          message: `Your appointment is confirmed for ${date} at ${startTime}.`,
        }
      });

      // Notify Doctor
      await tx.notification.create({
        data: {
          userId: doctor.userId,
          appointmentId: appointment.id,
          title: 'New Booking',
          message: `New appointment booked on ${date} at ${startTime}.`,
        }
      });

      return appointment;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all appointments for logged-in user (Role based)
 * @route   GET /api/v1/appointments
 * @access  Protected
 */
export const getAppointments = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    let whereClause = {};

    if (userRole === 'PATIENT') {
      whereClause = { patientId: userId };
    } else if (userRole === 'DOCTOR') {
      // Find the doctor ID for this user
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) throw new Error('Doctor profile not found');
      whereClause = { doctorId: doctor.id };
    } else if (userRole === 'RECEPTIONIST') {
      const recp = await prisma.receptionist.findUnique({ where: { userId } });
      // Get all doctors in that clinic
      const clinicDoctors = await prisma.doctor.findMany({ where: { clinicId: recp.clinicId } });
      const doctorIds = clinicDoctors.map(d => d.id);
      whereClause = { doctorId: { in: doctorIds } };
    }
    // SUPER_ADMIN gets all (whereClause remains empty)

    const appointments = await prisma.appointment.findMany({
      where: { ...whereClause, deletedAt: null },
      orderBy: { date: 'asc' }, // Upcoming first
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            clinic: { select: { name: true, address: true } }
          }
        },
        patient: { select: { firstName: true, lastName: true, phone: true } },
      }
    });

    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    next(error);
  }
};