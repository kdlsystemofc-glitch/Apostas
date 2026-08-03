import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user] = useState({ id: 'mock-user-id', email: 'user@example.com', name: 'User' });
  const [isAuthenticated] = useState(true);
  const [isLoadingAuth] = useState(false);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);
  const [authChecked] = useState(true);
  const [appPublicSettings] = useState({});

  const logout = () => {};
  const navigateToLogin = () => {};
  const checkUserAuth = async () => {};
  const checkAppState = async () => {};

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
