import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';
import { sendError } from '../utils/responseHandler.js';

export const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Authentication token missing or invalid. Access denied.', 401);
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Find the user associated with this token
    const user = await User.findById(decoded.id);

    if (!user) {
      return sendError(res, 'The user belonging to this token no longer exists.', 401);
    }

    // Attach authenticated user to request context
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token has expired. Please log in again.', 401);
    }
    return sendError(res, 'Invalid authentication token.', 401);
  }
};

export default protect;
