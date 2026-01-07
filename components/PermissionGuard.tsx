
import React from 'react';
import { User, Permission } from '../types';

interface PermissionGuardProps {
  user: User; // Pass the full user object to check their permissions list
  requiredPermission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  user, 
  requiredPermission, 
  children,
  fallback = null 
}) => {
  // 1. Admin Override: 'ADMIN' role usually implies all access, 
  // but better to rely on the permission list if properly configured.
  // For safety, if role is explicitly 'ADMIN', allow.
  if (user.role === 'ADMIN') {
      return <>{children}</>;
  }

  // 2. Check if user's permissions array includes the required string
  if (user.permissions && user.permissions.includes(requiredPermission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default PermissionGuard;
