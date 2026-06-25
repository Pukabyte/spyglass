import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PERMISSIONS } from './userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROLES_FILE = join(__dirname, '..', 'data', 'roles.json');

// Predefined system roles (cannot be deleted, but can be modified)
export const SYSTEM_ROLES = ['admin', 'manager', 'operator', 'viewer'];

// Initialize roles file if it doesn't exist
function ensureRolesFile() {
  if (!fs.existsSync(ROLES_FILE)) {
    const defaultRoles = {
      roles: [],
      nextId: 1,
    };
    fs.writeFileSync(ROLES_FILE, JSON.stringify(defaultRoles, null, 2));
  }
}

// Read roles from file
function readRoles() {
  ensureRolesFile();
  try {
    const data = fs.readFileSync(ROLES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading roles file:', error);
    return { roles: [], nextId: 1 };
  }
}

// Write roles to file
function writeRoles(data) {
  ensureRolesFile();
  try {
    fs.writeFileSync(ROLES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing roles file:', error);
    return false;
  }
}

// Get all roles
export function getAllRoles() {
  const data = readRoles();
  return data.roles;
}

// Get role by ID
export function getRoleById(id) {
  const data = readRoles();
  return data.roles.find((r) => r.id === id) || null;
}

// Get role by name
export function getRoleByName(name) {
  const data = readRoles();
  return data.roles.find((r) => r.name === name) || null;
}

// Create new role
export function createRole(roleData) {
  const { displayName, permissions = [], description = '' } = roleData;

  if (!displayName) {
    throw new Error('Display name is required');
  }

  // Convert display name to role name: lowercase, spaces to underscores, remove invalid chars
  const name = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  if (!name) {
    throw new Error('Invalid role name: must contain at least one alphanumeric character');
  }

  const data = readRoles();

  // Check if role name already exists
  if (data.roles.some((r) => r.name === name)) {
    throw new Error('Role name already exists');
  }

  // Validate permissions
  const allPermissions = Object.values(PERMISSIONS);
  const invalidPermissions = permissions.filter((p) => !allPermissions.includes(p));
  if (invalidPermissions.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
  }

  const newRole = {
    id: data.nextId++,
    name,
    displayName,
    description,
    permissions,
    isSystem: SYSTEM_ROLES.includes(name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.roles.push(newRole);
  writeRoles(data);

  return newRole;
}

// Update role
export function updateRole(id, updates) {
  const data = readRoles();
  const roleIndex = data.roles.findIndex((r) => r.id === id);

  if (roleIndex === -1) {
    throw new Error('Role not found');
  }

  const role = data.roles[roleIndex];

  // Prevent changing system role names
  if (updates.name && updates.name !== role.name && role.isSystem) {
    throw new Error('Cannot change name of system role');
  }

  // Update display name if provided
  if (updates.displayName !== undefined) {
    role.displayName = updates.displayName;
    
    // For non-system roles, update the name based on display name
    if (!role.isSystem) {
      const newName = updates.displayName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      if (!newName) {
        throw new Error('Invalid role name: must contain at least one alphanumeric character');
      }
      
      // Check for duplicates (excluding current role)
      if (data.roles.some((r) => r.name === newName && r.id !== id)) {
        throw new Error('Role name already exists');
      }
      
      role.name = newName;
    }
  }

  // Update description if provided
  if (updates.description !== undefined) {
    role.description = updates.description;
  }

  // Update permissions if provided
  if (updates.permissions !== undefined) {
    // Validate permissions
    const allPermissions = Object.values(PERMISSIONS);
    const invalidPermissions = updates.permissions.filter((p) => !allPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }
    role.permissions = updates.permissions;
  }

  role.updatedAt = new Date().toISOString();
  writeRoles(data);

  return role;
}

// Delete role
export async function deleteRole(id) {
  const data = readRoles();
  const roleIndex = data.roles.findIndex((r) => r.id === id);

  if (roleIndex === -1) {
    throw new Error('Role not found');
  }

  const role = data.roles[roleIndex];

  // Prevent deletion of system roles
  if (role.isSystem) {
    throw new Error('Cannot delete system role');
  }

  // Check if any users are using this role
  const userManager = await import('./userManager.js');
  const users = userManager.getAllUsers();
  const usersWithRole = users.filter((u) => u.role === role.name);
  if (usersWithRole.length > 0) {
    throw new Error(`Cannot delete role: ${usersWithRole.length} user(s) are assigned to this role`);
  }

  data.roles.splice(roleIndex, 1);
  writeRoles(data);
  return true;
}

// Initialize default roles from userManager
export async function initializeDefaultRoles() {
  const data = readRoles();
  
  // Only initialize if no roles exist
  if (data.roles.length === 0) {
    const { ROLES } = await import('./userManager.js');
    
    // Import default roles from userManager
    const defaultRoles = Object.values(ROLES).map((role) => ({
      name: role.name,
      displayName: role.displayName,
      description: `System default ${role.displayName} role`,
      permissions: role.permissions,
      isSystem: true,
    }));

    defaultRoles.forEach((role, index) => {
      data.roles.push({
        id: index + 1,
        ...role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    data.nextId = defaultRoles.length + 1;
    writeRoles(data);
    console.log('Default roles initialized');
  }
}

