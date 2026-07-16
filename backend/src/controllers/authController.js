import { prisma } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';

/**
 * @desc    Register a new user (Patient or Doctor)
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const registerUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, role } = req.body;

    // Basic Validation (In a real app, use Zod middleware here)
    if (!firstName || !lastName || !email || !password) {
      res.status(400);
      throw new Error('Please provide all required fields');
    }

    // Check if user already exists
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user in Database
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash: hashedPassword,
        phone,
        role: role || 'PATIENT', // Default to patient
      },
    });

    // Generate Tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get tokens
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide email and password');
    }

    // Find user (ignoring soft-deleted users)
    const user = await prisma.user.findFirst({
      where: { 
        email,
        deletedAt: null 
      },
    });

    if (!user) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    // Check if account is active (Admin suspension check)
    if (!user.isActive) {
      res.status(403);
      throw new Error('Your account has been suspended. Contact support.');
    }

    // Verify Password
    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    // Generate Tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh Access Token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401);
      throw new Error('Refresh token is required');
    }

    // Verify token
    const decoded = verifyRefreshToken(refreshToken);

    // Ensure user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive || user.deletedAt) {
      res.status(401);
      throw new Error('Invalid refresh token or inactive user');
    }

    // Generate new Access Token only
    const tokens = generateTokens(user.id, user.role);

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    res.status(401);
    next(new Error('Invalid or expired refresh token'));
  }
};