import { prisma } from '../config/db.js';

/**
 * @desc    Get all verified doctors with search & filters
 * @route   GET /api/v1/doctors
 * @access  Public (or Patient)
 */
export const getDoctors = async (req, res, next) => {
  try {
    const { search, specialty } = req.query;

    const doctors = await prisma.doctor.findMany({
      where: {
        isVerified: true,
        deletedAt: null,
        ...(specialty && { specialization: specialty }),
        ...(search && {
          OR: [
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName: { contains: search, mode: 'insensitive' } } },
            { clinic: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        user: { select: { firstName: true, lastName: true, profileImage: true } },
        clinic: { select: { name: true, city: true, area: true, address: true } },
      },
    });

    res.status(200).json({ success: true, count: doctors.length, data: doctors });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single doctor profile
 * @route   GET /api/v1/doctors/:id
 * @access  Public
 */
export const getDoctorById = async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { firstName: true, lastName: true, profileImage: true } },
        clinic: true,
      },
    });

    if (!doctor) throw new Error('Doctor not found');

    res.status(200).json({ success: true, data: doctor });
  } catch (error) {
    res.status(404);
    next(error);
  }
};

/**
 * @desc    Generate available time slots for a specific date
 * @route   GET /api/v1/doctors/:id/slots?date=YYYY-MM-DD
 * @access  Protected (Patient)
 */
export const getDoctorSlots = async (req, res, next) => {
  try {
    const { id: doctorId } = req.params;
    const { date } = req.query; // Expecting YYYY-MM-DD

    if (!date) {
      res.status(400);
      throw new Error('Date is required (YYYY-MM-DD)');
    }

    const requestDate = new Date(date);
    const dayOfWeek = requestDate.getDay(); // 0 = Sunday, 6 = Saturday

    // 1. Get Doctor's Availability Rules for this specific day
    const availability = await prisma.availability.findUnique({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
    });

    if (!availability || availability.isHoliday) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 2. Fetch existing appointments for this date to remove them from available slots
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: new Date(date),
        status: { in: ['PENDING', 'CONFIRMED'] }, // Cancelled slots become available again
      },
      select: { startTime: true },
    });

    const bookedTimes = existingAppointments.map((apt) => apt.startTime);

    // 3. Generate Time Slots
    const slots = [];
    let currentTime = parseTime(availability.startTime);
    const endTime = parseTime(availability.endTime);
    const lunchStart = availability.lunchStart ? parseTime(availability.lunchStart) : null;
    const lunchEnd = availability.lunchEnd ? parseTime(availability.lunchEnd) : null;
    const duration = availability.slotDuration; // in minutes

    while (currentTime + duration <= endTime) {
      const slotStartTimeStr = formatTime(currentTime);
      const slotEndTimeStr = formatTime(currentTime + duration);

      const isLunchTime = lunchStart && lunchEnd && (currentTime >= lunchStart && currentTime < lunchEnd);
      const isBooked = bookedTimes.includes(slotStartTimeStr);

      if (!isLunchTime && !isBooked) {
        slots.push({
          startTime: slotStartTimeStr,
          endTime: slotEndTimeStr,
        });
      }

      currentTime += duration;
    }

    res.status(200).json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

// Helper functions to handle time math (minutes since midnight)
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};