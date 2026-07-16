import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler.js';
import doctorRoutes from './routes/doctorRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';

// Load env vars
dotenv.config();

const app = express();

// Security Middlewares
app.use(helmet()); // Sets secure HTTP headers
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json()); // Body parser

// ... existing middleware imports ...
import authRoutes from './routes/authRoutes.js';

// ... existing app.use() declarations ...

// Mount Routes
app.use('/api/v1/auth', authRoutes);

// ... existing 404 and Error Handler ...

// Rate Limiting: Max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Placeholder for Routes (To be added in next phase)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running securely.' });
});

// Fallback Route for 404
app.use((req, res, next) => {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);

  // ... existing code ...
  app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
});