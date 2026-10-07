// Run through backend/scripts/check_browser.py: isolated server/database and Chrome profile.
import assert from 'node:assert/strict';
const origin = process.argv[2];
const debuggerUrl = process.argv[3];
const socket = new WebSocket(debuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
const events = new Set();
socket.onmessage = message => {
  const result = JSON.parse(message.data);
  if (result.id) {
    const operation = pending.get(result.id);
    pending.delete(result.id);
    if (result.error) operation.reject(new Error(JSON.stringify(result.error)));
    else operation.resolve(result.result);
  } else for (const listener of events) listener(result);
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const evaluate = async (session, expression) => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};
const wait = async (session, expression) => {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (await evaluate(session, expression)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('UI condition timed out: ' + expression + '\n' + await evaluate(session, 'document.body.innerText'));
};
const setInput = (session, id, value) => evaluate(session, `(() => {
  const node = document.getElementById(${JSON.stringify(id)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, ${JSON.stringify(value)});
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const click = (session, id) => evaluate(session, `document.getElementById(${JSON.stringify(id)}).click()`);
const body = session => evaluate(session, 'document.body.innerText');
const newPage = async () => {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: origin }, sessionId);
  await wait(sessionId, '!!document.getElementById("submit-enquiry-btn") && !document.getElementById("submit-enquiry-btn").disabled');
  return sessionId;
};
let externalRequests = [];
let errors = [];
events.add(event => {
  if (event.method === 'Network.requestWillBeSent' && /^https?:/.test(event.params.request.url) && !event.params.request.url.startsWith(origin)) externalRequests.push(event.params.request.url);
  if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails);
});
try {
  const caregiver = await newPage();
  const staff = await newPage();
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("awaiting_check")');
  const enquiryId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await click(staff, 'role-staff-btn');
  assert.equal(await evaluate(staff, 'document.getElementById("staff-token-input").value'), '');
  await setInput(staff, 'staff-token-input', 'browser-test-only-token');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, `document.body.innerText.includes(${JSON.stringify(enquiryId)}) && !!document.getElementById('submit-observation-btn')`);
  await setInput(staff, 'obtainable-count-input', '4');
  await evaluate(staff, `Array.from(document.querySelectorAll('button')).find(node => node.textContent.includes('Set simulated check time to now')).click()`);
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("INSUFFICIENT")');
  assert.match(await body(caregiver), /Discrepancy: -8/);
  assert.match(await body(caregiver), /Exact request: Demo Medicine A/);
  console.log('PASS: separate caregiver/staff contexts, explicit credential, persisted golden mismatch');

  // Fail one response after the real server accepted the report; inspect must recover without a second PUT.
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("awaiting_check")');
  const lostId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, `document.body.innerText.includes(${JSON.stringify(lostId)}) && !!document.getElementById('submit-observation-btn')`);
  await setInput(staff, 'obtainable-count-input', '0');
  await evaluate(staff, `Array.from(document.querySelectorAll('button')).find(node => node.textContent.includes('Set simulated check time to now')).click()`);
  let dropped = false;
  let reportWrites = 0;
  const loseResponse = event => {
    if (event.sessionId === staff && event.method === 'Network.requestWillBeSent' && event.params.request.method === 'PUT') reportWrites++;
    if (event.sessionId === staff && event.method === 'Fetch.requestPaused') {
      if (!dropped && event.params.request.url.endsWith('/observation') && event.params.responseStatusCode === 201) {
        dropped = true;
        send('Fetch.failRequest', { requestId: event.params.requestId, errorReason: 'Failed' }, staff);
      } else send('Fetch.continueRequest', { requestId: event.params.requestId }, staff);
    }
  };
  events.add(loseResponse);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*observation', requestStage: 'Response' }] }, staff);
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Save outcome requires inspection")');
  assert.equal(dropped, true);
  assert.equal(await evaluate(staff, 'document.getElementById("submit-observation-btn").disabled'), true);
  // Reload must retain the intent without retaining the credential.
  await send('Page.reload', {}, staff);
  await wait(staff, 'document.body.innerText.includes("unfinished save intent was recovered")');
  await evaluate(staff, `Array.from(document.querySelectorAll('button')).find(node => node.textContent === 'Inspect saved outcome').click()`);
  await wait(staff, 'document.body.innerText.includes("Save confirmed by the server")');
  assert.equal(reportWrites, 1);
  await send('Fetch.disable', {}, staff);
  events.delete(loseResponse);
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Discrepancy: -12")');
  console.log('PASS: lost committed report response, reload recovery, inspection, no automatic retry');

  // A failed read must retain last-loaded evidence and label it.
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, caregiver);
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("latest refresh failed")');
  assert.match(await body(caregiver), /Discrepancy: -12/);
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, caregiver);
  console.log('PASS: failed refresh retains and labels previously loaded evidence');
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);
  console.log('PASS: no external runtime HTTP requests and no uncaught browser errors');
} finally {
  try { await send('Browser.close'); } catch { /* Browser may have already closed. */ }
  socket.close();
}
