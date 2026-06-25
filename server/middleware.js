import { getUserById, hasPermission, hasAnyPermission, hasAllPermissions } from './userManager.js';

// Enhanced authentication middleware
export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Permission check middleware factory
export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.session || !req.session.authenticated || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = getUserById(req.session.userId);
    if (!user || !hasPermission(user, permission)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    req.user = user;
    next();
  };
}

// Require any of the specified permissions
export function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    if (!req.session || !req.session.authenticated || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = getUserById(req.session.userId);
    if (!user || !hasAnyPermission(user, permissions)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    req.user = user;
    next();
  };
}

// Require all of the specified permissions
export function requireAllPermissions(...permissions) {
  return async (req, res, next) => {
    if (!req.session || !req.session.authenticated || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = getUserById(req.session.userId);
    if (!user || !hasAllPermissions(user, permissions)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    req.user = user;
    next();
  };
}

// Middleware to attach user to request (optional, doesn't require auth)
export function attachUser(req, res, next) {
  if (req.session && req.session.authenticated && req.session.userId) {
    req.user = getUserById(req.session.userId);
  }
  next();
}

