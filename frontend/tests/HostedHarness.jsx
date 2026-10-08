import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import HostedWorkspace from '../src/HostedWorkspace';
import '../src/index.css';
// Test-only identities; this entry is never included by the production Vite build.
const accounts = {
  'caregiver-1': 'sub_caregiver_1', 'caregiver-2': 'sub_caregiver_2',
  'staff-a-1': 'sub_staff_a_1', 'staff-b': 'sub_staff_b', 'staff-multi': 'sub_staff_multi',
};
function Harness() {
  const [account, setAccount] = useState(new URLSearchParams(location.search).get('test-account') || 'caregiver-1');
  return <><label>Test identity<select id="test-account" value={account} onChange={event => setAccount(event.target.value)}>{Object.keys(accounts).map(key => <option key={key}>{key}</option>)}</select></label>
    <HostedWorkspace key={account} authSubject={accounts[account]} getToken={async () => 'token-' + account} /></>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);
