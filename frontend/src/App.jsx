import { errorText } from "./services/presentation";
import { lazy, Suspense, useEffect, useState } from 'react';
import { getPublicConfig } from './services/api';
import { Notice, Shell } from './components/WorkspaceUI';
const LocalApp = lazy(() => import('./LocalApp'));
const HostedApp = lazy(() => import('./HostedApp'));
export default function App() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    getPublicConfig().then(value => { if (current) { setConfig(value); setError(null); } })
      .catch(failure => { if (current) setError(failure); });
    return () => { current = false; };
  }, [attempt]);
  if (!config) return <Shell><section className="panel">{error ? <><Notice kind="error">{errorText(error)}</Notice><button onClick={() => setAttempt(value => value + 1)}>Retry connection</button></> : <p role="status">Connecting to Medicine Check…</p>}</section></Shell>;
  return <Suspense fallback={<Shell hosted={config.mode === 'hosted'}><p role="status">Opening your workspace…</p></Shell>}>
    {config.mode === 'hosted' ? <HostedApp publishableKey={config.clerk_publishable_key} /> : <LocalApp />}
  </Suspense>;
}
