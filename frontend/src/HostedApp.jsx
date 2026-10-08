import { useEffect, useRef, useState } from 'react';
import { ClerkProvider, SignIn, SignUp, UserButton, useAuth, useUser } from '@clerk/react';
import HostedWorkspace from './HostedWorkspace';
import { Shell } from './components/WorkspaceUI';
import { clearHostedRecovery } from './hooks/useHostedRecovery';

function Session() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const previous = useRef(null);
  const [register, setRegister] = useState(false);
  const subject = isSignedIn ? user?.id : null;
  useEffect(() => {
    if (!isLoaded) return;
    if (previous.current && previous.current !== subject) {
      try {
        const key = 'medicine_check_auth_user_' + previous.current;
        const localId = sessionStorage.getItem(key);
        if (localId) clearHostedRecovery(localId);
        sessionStorage.removeItem(key);
      } catch { /* storage unavailable */ }
    }
    previous.current = subject;
  }, [isLoaded, subject]);
  if (!isLoaded) return <Shell hosted><p role="status">Loading sign-in…</p></Shell>;
  if (!isSignedIn) return <Shell hosted><section className="auth-panel"><span className="eyebrow">Your Medicine Check account</span>
    <h1>{register ? 'Create your account.' : 'Welcome back.'}</h1><p>Sign in to manage your own requests. Pharmacy access is assigned separately by an operator.</p>
    <div className="auth-provider">{register ? <SignUp routing="hash" /> : <SignIn routing="hash" />}</div>
    <button className="text-button" onClick={() => setRegister(value => !value)}>{register ? 'Already registered? Sign in' : 'New here? Create an account'}</button>
  </section></Shell>;
  const currentToken = async () => {
    const token = await getToken();
    if (!token) throw { kind: 'client', outcome: 'not_applicable', message: 'Your session has ended. Sign in again.' };
    return token;
  };
  return <HostedWorkspace key={subject} authSubject={subject} getToken={currentToken} accountControl={<UserButton />} />;
}
export default function HostedApp({ publishableKey }) {
  return <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/"><Session /></ClerkProvider>;
}
