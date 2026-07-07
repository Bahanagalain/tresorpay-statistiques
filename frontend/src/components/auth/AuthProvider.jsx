import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMyAccessModel, getMyProfile, loginRequest, logoutRequest } from '../../api/authApi';
import { clearSession, getStoredAccessModel, getStoredTokens, getStoredUser, storeAccessModel, storeTokens, storeUser } from '../../api/session';

const AuthContext = createContext({
  status: 'loading',
  isAuthenticated: false,
  user: null,
  accessModel: null,
  login: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
  hasRole: () => false,
  hasPrivilege: () => false,
});

async function bootstrapProfile() {
  const [profileRes, accessRes] = await Promise.all([
    getMyProfile(),
    getMyAccessModel(),
  ]);

  const user = profileRes?.datas || profileRes;
  const accessModel = accessRes?.datas || accessRes;

  storeUser(user);
  storeAccessModel(accessModel);
  return { user, accessModel };
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(getStoredUser);
  const [accessModel, setAccessModel] = useState(getStoredAccessModel);

  const resetAuth = useCallback(() => {
    clearSession();
    setUser(null);
    setAccessModel(null);
    setStatus('unauthenticated');
  }, []);

  const refreshProfile = useCallback(async () => {
    const { user: nextUser, accessModel: nextAccessModel } = await bootstrapProfile();
    setUser(nextUser);
    setAccessModel(nextAccessModel);
    setStatus('authenticated');
    return { user: nextUser, accessModel: nextAccessModel };
  }, []);

  useEffect(() => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setStatus('unauthenticated');
      return;
    }

    refreshProfile().catch(() => {
      resetAuth();
    });
  }, [refreshProfile, resetAuth]);

  useEffect(() => {
    const syncFromSession = () => {
      const { accessToken } = getStoredTokens();
      setUser(getStoredUser());
      setAccessModel(getStoredAccessModel());
      setStatus(accessToken ? 'authenticated' : 'unauthenticated');
    };

    window.addEventListener('auth:session-cleared', syncFromSession);
    window.addEventListener('storage', syncFromSession);

    return () => {
      window.removeEventListener('auth:session-cleared', syncFromSession);
      window.removeEventListener('storage', syncFromSession);
    };
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const response = await loginRequest({ username, password });
    const authData = response?.datas;

    if (!authData?.access_token) {
      throw new Error(response?.message || 'Réponse d’authentification invalide');
    }

    storeTokens({
      accessToken: authData.access_token,
      refreshToken: authData.refresh_token,
      tokenType: authData.token_type || 'Bearer',
    });

    if (authData.utilisateur) {
      storeUser(authData.utilisateur);
      setUser(authData.utilisateur);
    }

    try {
      await refreshProfile();
    } catch (error) {
      resetAuth();
      throw error;
    }

    return response;
  }, [refreshProfile, resetAuth]);

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    try {
      if (refreshToken) {
        await logoutRequest(refreshToken);
      }
    } catch {
      // Logout should remain best-effort on a stateless JWT flow.
    } finally {
      resetAuth();
    }
  }, [resetAuth]);

  const hasRole = useCallback((roleCode) => {
    if (!roleCode) return false;
    const roles = accessModel?.roles || [];
    return roles.some((role) => role.code === roleCode || role.label === roleCode);
  }, [accessModel]);

  const hasPrivilege = useCallback((privilegeCode) => {
    if (!privilegeCode) return false;
    const privileges = accessModel?.privileges_effectifs || accessModel?.effective_privileges || user?.privileges || [];
    return privileges.includes(privilegeCode);
  }, [accessModel, user]);

  const value = useMemo(() => ({
    status,
    isAuthenticated: status === 'authenticated',
    user,
    accessModel,
    login,
    logout,
    refreshProfile,
    hasRole,
    hasPrivilege,
  }), [accessModel, hasPrivilege, hasRole, login, logout, refreshProfile, status, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
