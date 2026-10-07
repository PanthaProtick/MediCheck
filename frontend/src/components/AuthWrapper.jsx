import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserButton,
  useUser,
  useAuth as useClerkAuth,
} from '@clerk/react';
import { Lock, UserCheck, Shield, AlertTriangle } from 'lucide-react';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

const AuthContext = createContext({
  isSignedIn: false,
  isLoaded: true,
  user: null,
  getToken: async () => '',
  signOut: () => {},
});

export function useAppAuth() {
  return useContext(AuthContext);
}

function ClerkAuthBridge({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useClerkAuth();

  const authValue = {
    isSignedIn: !!isSignedIn,
    isLoaded: !!isLoaded,
    user: user
      ? {
          id: user.id,
          fullName: user.fullName || user.primaryEmailAddress?.emailAddress || 'Authenticated User',
          email: user.primaryEmailAddress?.emailAddress || '',
        }
      : null,
    getToken: async () => {
      if (!getToken) return '';
      return (await getToken()) || '';
    },
    signOut: () => {
      sessionStorage.clear();
      if (signOut) signOut();
    },
  };

  return (
    <AuthContext.Provider value={authValue}>
      <SignedOut>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
            <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-4 text-indigo-400">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Medicine Availability Verification</h1>
            <p className="text-sm text-slate-400 mb-6">
              Sign in with your verified caregiver or staff account to access real-time medicine availability checks across participating pharmacies.
            </p>
            <div className="flex justify-center">
              <SignIn routing="hash" />
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </AuthContext.Provider>
  );
}

function DevFallbackAuthBridge({ children }) {
  const [activeAccount, setActiveAccount] = useState(() => {
    return sessionStorage.getItem('dev_auth_account') || 'caregiver_1';
  });

  const devAccounts = {
    caregiver_1: { id: 'c1000000-0000-4000-8000-000000000001', name: 'Caregiver 1 (Demo)', role: 'Caregiver' },
    caregiver_2: { id: 'c2000000-0000-4000-8000-000000000002', name: 'Caregiver 2 (Demo)', role: 'Caregiver' },
    staff_a_1: { id: 'a1000000-0000-4000-8000-000000000001', name: 'Staff Member 1 (Pharmacy A)', role: 'Staff PHARM-A' },
    staff_b: { id: 'b1000000-0000-4000-8000-000000000003', name: 'Staff Member 2 (Pharmacy B)', role: 'Staff PHARM-B' },
  };

  const current = devAccounts[activeAccount] || devAccounts.caregiver_1;

  const authValue = {
    isSignedIn: true,
    isLoaded: true,
    user: {
      id: current.id,
      fullName: current.name,
      email: `${activeAccount}@demo.local`,
    },
    getToken: async () => `test-token-${activeAccount}`,
    signOut: () => {
      sessionStorage.clear();
      setActiveAccount('caregiver_1');
    },
  };

  const handleSwitch = (accountKey) => {
    sessionStorage.clear();
    sessionStorage.setItem('dev_auth_account', accountKey);
    setActiveAccount(accountKey);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={authValue}>
      <div className="bg-amber-950/40 border-b border-amber-500/30 text-amber-200 text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Local Dev Auth Mode:</strong> VITE_CLERK_PUBLISHABLE_KEY not set. Using test session credentials.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Switch Account:</span>
          {Object.entries(devAccounts).map(([key, acc]) => (
            <button
              key={key}
              onClick={() => handleSwitch(key)}
              className={`px-2 py-0.5 rounded font-mono transition-colors ${
                activeAccount === key
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {acc.name.split(' ')[0]} ({acc.role})
            </button>
          ))}
        </div>
      </div>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthWrapper({ children }) {
  if (CLERK_PUBLISHABLE_KEY && CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }

  return <DevFallbackAuthBridge>{children}</DevFallbackAuthBridge>;
}
