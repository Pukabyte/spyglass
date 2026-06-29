import fs from 'fs';
import bcrypt from 'bcrypt';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USERS_FILE = join(__dirname, '..', 'data', 'users.json');
const SALT_ROUNDS = 10;

// Default permissions structure
export const PERMISSIONS = {
  // Dashboard permissions
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_EDIT: 'dashboard:edit',
  
  // Server permissions
  SERVER_VIEW: 'server:view',
  SERVER_CONTROL: 'server:control',
  
  // Docker permissions
  DOCKER_VIEW: 'docker:view',
  DOCKER_START: 'docker:start',
  DOCKER_STOP: 'docker:stop',
  DOCKER_RESTART: 'docker:restart',
  DOCKER_DELETE: 'docker:delete',
  
  // Saltbox permissions
  SALTBOX_VIEW: 'saltbox:view',
  SALTBOX_EXECUTE: 'saltbox:execute',
  
  // Config permissions
  CONFIG_VIEW: 'config:view',
  CONFIG_EDIT: 'config:edit',
  
  // Widget permissions
  WIDGET_VIEW: 'widget:view',
  WIDGET_CREATE: 'widget:create',
  WIDGET_EDIT: 'widget:edit',
  WIDGET_DELETE: 'widget:delete',
  
  // Terminal permissions
  TERMINAL_VIEW: 'terminal:view',
  TERMINAL_EXECUTE: 'terminal:execute',
  
  // User management permissions
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  
  // App Store permissions
  APPSTORE_VIEW: 'appstore:view',
  APPSTORE_INSTALL: 'appstore:install',
};

// Predefined roles with permissions
export const ROLES = {
  ADMIN: {
    name: 'admin',
    displayName: 'Administrator',
    permissions: Object.values(PERMISSIONS),
  },
  MANAGER: {
    name: 'manager',
    displayName: 'Manager',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DASHBOARD_EDIT,
      PERMISSIONS.SERVER_VIEW,
      PERMISSIONS.DOCKER_VIEW,
      PERMISSIONS.DOCKER_START,
      PERMISSIONS.DOCKER_STOP,
      PERMISSIONS.DOCKER_RESTART,
      PERMISSIONS.SALTBOX_VIEW,
      PERMISSIONS.CONFIG_VIEW,
      PERMISSIONS.CONFIG_EDIT,
      PERMISSIONS.WIDGET_VIEW,
      PERMISSIONS.WIDGET_CREATE,
      PERMISSIONS.WIDGET_EDIT,
      PERMISSIONS.WIDGET_DELETE,
      PERMISSIONS.TERMINAL_VIEW,
      PERMISSIONS.APPSTORE_VIEW,
      PERMISSIONS.USERS_VIEW,
    ],
  },
  OPERATOR: {
    name: 'operator',
    displayName: 'Operator',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SERVER_VIEW,
      PERMISSIONS.DOCKER_VIEW,
      PERMISSIONS.DOCKER_START,
      PERMISSIONS.DOCKER_STOP,
      PERMISSIONS.DOCKER_RESTART,
      PERMISSIONS.SALTBOX_VIEW,
      PERMISSIONS.CONFIG_VIEW,
      PERMISSIONS.WIDGET_VIEW,
      PERMISSIONS.TERMINAL_VIEW,
      PERMISSIONS.APPSTORE_VIEW,
    ],
  },
  VIEWER: {
    name: 'viewer',
    displayName: 'Viewer',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SERVER_VIEW,
      PERMISSIONS.DOCKER_VIEW,
      PERMISSIONS.SALTBOX_VIEW,
      PERMISSIONS.CONFIG_VIEW,
      PERMISSIONS.WIDGET_VIEW,
      PERMISSIONS.APPSTORE_VIEW,
    ],
  },
};

// Initialize users file if it doesn't exist
function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = {
      users: [],
      nextId: 1,
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
  }
}

// Read users from file
function readUsers() {
  ensureUsersFile();
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return { users: [], nextId: 1 };
  }
}

// Write users to file
function writeUsers(data) {
  ensureUsersFile();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing users file:', error);
    return false;
  }
}

// Get all users (without passwords)
export function getAllUsers() {
  const data = readUsers();
  return data.users.map(({ password, ...user }) => user);
}

// Get user by ID (without password)
export function getUserById(id) {
  const data = readUsers();
  const user = data.users.find((u) => u.id === id);
  if (!user) return null;
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Get user by username (with password for authentication)
export function getUserByUsername(username) {
  const data = readUsers();
  return data.users.find((u) => u.username === username) || null;
}

// Verify password
export async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Hash password
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Get role data (from roleManager or fallback to predefined)
async function getRoleData(roleName) {
  try {
    const roleManager = await import('./roleManager.js');
    const role = roleManager.getRoleByName(roleName);
    if (role) {
      return {
        name: role.name,
        permissions: role.permissions,
      };
    }
  } catch (error) {
    // Fallback to predefined roles
  }
  
  // Fallback to predefined roles
  if (roleName && ROLES[roleName.toUpperCase()]) {
    const roleData = ROLES[roleName.toUpperCase()];
    return {
      name: roleData.name,
      permissions: roleData.permissions,
    };
  }
  
  // Default to viewer
  return {
    name: ROLES.VIEWER.name,
    permissions: ROLES.VIEWER.permissions,
  };
}

// Create new user
export async function createUser(userData) {
  const { username, password, email, role, permissions = [] } = userData;

  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const data = readUsers();

  // Check if username already exists
  if (data.users.some((u) => u.username === username)) {
    throw new Error('Username already exists');
  }

  const hashedPassword = await hashPassword(password);
  const roleData = await getRoleData(role);

  const newUser = {
    id: data.nextId++,
    username,
    password: hashedPassword,
    email: email || null,
    role: roleData.name,
    // Store per-user extras only; role permissions are merged at read time
    // (getEffectivePermissions) so role edits stay authoritative.
    permissions: permissions.filter((p) => !roleData.permissions.includes(p)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    active: true,
  };

  data.users.push(newUser);
  writeUsers(data);

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

// Update user
export async function updateUser(id, updates) {
  const data = readUsers();
  const userIndex = data.users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    throw new Error('User not found');
  }

  const user = data.users[userIndex];

  // Update username if provided and check for duplicates
  if (updates.username && updates.username !== user.username) {
    if (data.users.some((u) => u.username === updates.username && u.id !== id)) {
      throw new Error('Username already exists');
    }
    user.username = updates.username;
  }

  // Update password if provided
  if (updates.password) {
    user.password = await hashPassword(updates.password);
  }

  // Update email if provided
  if (updates.email !== undefined) {
    user.email = updates.email;
  }

  // Update role if provided
  if (updates.role) {
    const roleData = await getRoleData(updates.role);
    user.role = roleData.name;
    // No custom permissions => clear extras; the role supplies perms live.
    if (!updates.permissions || updates.permissions.length === 0) {
      user.permissions = [];
    }
  }

  // Update permissions if provided: store extras only (minus role defaults),
  // so role edits remain authoritative for everything the role grants.
  if (updates.permissions !== undefined) {
    const roleData = await getRoleData(updates.role || user.role);
    user.permissions = updates.permissions.filter((p) => !roleData.permissions.includes(p));
  }

  // Update active status if provided
  if (updates.active !== undefined) {
    user.active = updates.active;
  }

  user.updatedAt = new Date().toISOString();
  writeUsers(data);

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Delete user
export function deleteUser(id) {
  const data = readUsers();
  const userIndex = data.users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    throw new Error('User not found');
  }

  data.users.splice(userIndex, 1);
  writeUsers(data);
  return true;
}

// Get effective permissions by combining user's stored permissions with their role's permissions
export function getEffectivePermissions(user) {
  if (!user) return [];
  const stored = user.permissions || [];

  if (user.role) {
    // Try to load custom roles from roles.json (supports custom roles from roleManager)
    try {
      const rolesFile = join(__dirname, '..', 'data', 'roles.json');
      if (fs.existsSync(rolesFile)) {
        const rolesData = JSON.parse(fs.readFileSync(rolesFile, 'utf8'));
        const role = rolesData.roles.find((r) => r.name === user.role);
        if (role) {
          return [...new Set([...stored, ...role.permissions])];
        }
      }
    } catch (error) {
      // Fall through to hardcoded roles
    }

    // Fallback to hardcoded roles
    if (ROLES[user.role.toUpperCase()]) {
      const rolePerms = ROLES[user.role.toUpperCase()].permissions;
      return [...new Set([...stored, ...rolePerms])];
    }
  }
  return stored;
}

// One-time/idempotent migration: strip role-default permissions from each
// user's stored array, leaving only genuine per-user extras. Safe to run on
// every boot — once stripped, re-running is a no-op.
export async function migratePermissionsToExtras() {
  const data = readUsers();
  let changed = false;
  for (const user of data.users) {
    if (!user.role || !Array.isArray(user.permissions)) continue;
    const roleData = await getRoleData(user.role);
    const extras = user.permissions.filter((p) => !roleData.permissions.includes(p));
    if (extras.length !== user.permissions.length) {
      user.permissions = extras;
      changed = true;
    }
  }
  if (changed) writeUsers(data);
}

export function hasPermission(user, permission) {
  if (!user || !user.active) return false;
  return getEffectivePermissions(user).includes(permission);
}

// Check if user has any of the specified permissions
export function hasAnyPermission(user, permissions) {
  if (!user || !user.active) return false;
  const effective = getEffectivePermissions(user);
  return permissions.some((perm) => effective.includes(perm));
}

// Check if user has all of the specified permissions
export function hasAllPermissions(user, permissions) {
  if (!user || !user.active) return false;
  const effective = getEffectivePermissions(user);
  return permissions.every((perm) => effective.includes(perm));
}

// Initialize with admin user from accounts.yml if no users exist
export async function initializeDefaultAdmin(getCredentialsFromAccounts) {
  const data = readUsers();
  if (data.users.length === 0) {
    // Initialize roles first
    const roleManager = await import('./roleManager.js');
    await roleManager.initializeDefaultRoles();
    
    // Try to get credentials from accounts.yml
    const credentials = getCredentialsFromAccounts();
    
    if (credentials && credentials.username && credentials.password) {
      // Get admin role permissions
      const roleData = await getRoleData('admin');
      
      // Create admin user from accounts.yml
      const hashedPassword = await hashPassword(credentials.password);
      const adminUser = {
        id: 1,
        username: credentials.username,
        password: hashedPassword,
        email: null,
        role: 'admin',
        permissions: roleData.permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
      };
      data.users.push(adminUser);
      data.nextId = 2;
      writeUsers(data);
      console.log(`Admin user created from accounts.yml (username: ${credentials.username})`);
    } else {
      console.log('No users found and accounts.yml not available. Users must be created manually.');
    }
  }
}

