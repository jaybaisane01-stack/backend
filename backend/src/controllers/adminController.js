import { prisma } from '../config/db.js';

/**
 * @desc    Get platform-wide statistics for the Admin Dashboard
 * @route   GET /api/v1/admin/stats
 * @access  Protected (SUPER_ADMIN only)
 */
export const getPlatformStats = async (req, res, next) => {
  try {
    // Run all count queries concurrently for speed
    const [
      totalPatients,
      totalDoctors,
      pendingDoctors,
      totalClinics,
      totalAppointments,
      todayAppointments
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'PATIENT', deletedAt: null } }),
      prisma.doctor.count({ where: { deletedAt: null } }),
      prisma.doctor.count({ where: { isVerified: false, deletedAt: null } }),
      prisma.clinic.count({ where: { deletedAt: null } }),
      prisma.appointment.count(),
      prisma.appointment.count({
        where: {
          date: new Date(new Date().setHours(0,0,0,0))
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: { patients: totalPatients, doctors: totalDoctors, pendingDoctors },
        clinics: totalClinics,
        appointments: { total: totalAppointments, today: todayAppointments }
      }
    });
  } catch (error) {
    next(error);
  }
};