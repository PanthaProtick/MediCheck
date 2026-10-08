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

const setSelect = (session, id, value) => evaluate(session, `(() => {
  const node = document.getElementById(${JSON.stringify(id)});
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(node, ${JSON.stringify(value)});
  node.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const newPage = async (account, role) => {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId); await send('Network.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: origin + '?test-account=' + account + '&role=' + role }, sessionId);
  await wait(sessionId, role === 'caregiver' ? '!!document.getElementById("submit-enquiry-btn")' : '!!document.getElementById("staff-pharmacy-select")');
  return sessionId;
};
const selectRequest = async (session, id) => {
  await click(session, 'refresh-queue-btn');
  await wait(session, `Array.from(document.querySelectorAll('.queue-item')).some(node => node.textContent.includes(${JSON.stringify(id)}))`);
  await evaluate(session, `Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(id)})).click()`);
};
const errors = [], localCalls = [];
events.add(event => {
  if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails);
  if (event.method === 'Network.requestWillBeSent' && event.params.request.url.includes('/api/v1/')) localCalls.push(event.params.request.url);
});
try {
  const caregiver = await newPage('caregiver-1', 'caregiver');
  const other = await newPage('caregiver-2', 'caregiver');
  const staff = await newPage('staff-a-1', 'staff');
  const staffB = await newPage('staff-b', 'staff');
  const multi = await newPage('staff-multi', 'staff');
  assert.equal(await evaluate(staff, '!!document.getElementById("staff-token-input")'), false);
  assert.equal(await evaluate(caregiver, '!!document.getElementById("submit-observation-btn")'), false);
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const id = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  const forbidden = await evaluate(other, `fetch('/api/v2/enquiries/${id}',{headers:{Authorization:'Bearer token-caregiver-2'}}).then(r=>r.status)`);
  assert.equal(forbidden, 404);
  assert.equal((await body(other)).includes(id), false);
  await click(staffB, 'refresh-queue-btn');
  await wait(staffB, 'document.body.innerText.includes("No pending requests on this page")');
  assert.equal((await body(staffB)).includes(id), false);
  assert.equal(await evaluate(staff, 'document.getElementById("staff-pharmacy-select").options.length'), 1);
  await selectRequest(staff, id);
  await setInput(staff, 'obtainable-count-input', '4');
  await evaluate(staff, 'Array.from(document.querySelectorAll("button")).find(node => node.textContent === "Set simulated check time to now").click()');
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Discrepancy: -8")');
  assert.match(await body(caregiver), /Not enough for this request/);
  console.log('PASS: hosted golden path, owned requests and pharmacy queue isolation');

  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const lostId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await selectRequest(staff, lostId);
  await setInput(staff, 'obtainable-count-input', '0');
  await evaluate(staff, 'Array.from(document.querySelectorAll("button")).find(node => node.textContent === "Set simulated check time to now").click()');
  let dropped = false, writes = 0;
  const lose = event => {
    if (event.sessionId === staff && event.method === 'Network.requestWillBeSent' && event.params.request.method === 'PUT') writes++;
    if (event.sessionId === staff && event.method === 'Fetch.requestPaused') {
      if (!dropped && event.params.responseStatusCode === 201) {
        dropped = true; send('Fetch.failRequest', { requestId: event.params.requestId, errorReason: 'Failed' }, staff);
      } else send('Fetch.continueRequest', { requestId: event.params.requestId }, staff);
    }
  };
  events.add(lose); await send('Fetch.enable', { patterns: [{ urlPattern:'*observation', requestStage:'Response' }] }, staff);
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Save outcome requires inspection")');
  assert.equal(await evaluate(staff, 'document.getElementById("staff-pharmacy-select").disabled'), true);
  await send('Page.reload', {}, staff);
  await wait(staff, 'document.body.innerText.includes("unfinished save intent was recovered")');
  await evaluate(staff, 'Array.from(document.querySelectorAll("button")).find(node => node.textContent === "Inspect saved outcome").click()');
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
  assert.equal(writes, 1); assert.equal(dropped, true);
  await send('Fetch.disable', {}, staff); events.delete(lose);
  await click(caregiver, 'refresh-enquiry-btn'); await wait(caregiver, 'document.body.innerText.includes("Discrepancy: -12")');
  console.log('PASS: account-bound report recovery after reload without duplicate PUT');

  await setSelect(caregiver, 'pharmacy-select', 'PHARM-B');
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const pharmacyBId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await click(multi, 'refresh-queue-btn');
  await wait(multi, 'document.body.innerText.includes("No pending requests on this page")');
  await setSelect(multi, 'staff-pharmacy-select', 'PHARM-B');
  assert.equal(await evaluate(multi, 'document.querySelectorAll(".queue-item").length'), 0);
  assert.equal(await evaluate(multi, '!!document.getElementById("submit-observation-btn")'), false);
  await selectRequest(multi, pharmacyBId);
  await setSelect(multi, 'staff-pharmacy-select', 'PHARM-A');
  assert.equal(await evaluate(multi, '!!document.getElementById("submit-observation-btn")'), false);
  await selectRequest(staffB, pharmacyBId);
  await evaluate(staffB, 'document.querySelectorAll("input[name=report-kind]")[1].click()');
  await click(staffB, 'submit-observation-btn');
  await wait(staffB, 'document.body.innerText.includes("Report Accepted")');
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Staff could not complete the check")');
  console.log('PASS: multi-membership selection resets report state; second pharmacy workflow works');

  await setSelect(caregiver, 'test-account', 'caregiver-2');
  await wait(caregiver, 'document.body.innerText.includes("Enquiry not found")');
  assert.equal(await evaluate(caregiver, '!!document.querySelector("[aria-label=\\"Saved enquiry result\\"]")'), false);
  assert.equal(await evaluate(caregiver, 'document.querySelectorAll(".queue-item").length'), 0);
  console.log('PASS: account switch unmounts prior user views and request history');

  await send('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true }, staffB);
  assert.equal(await evaluate(staffB, 'document.documentElement.scrollWidth <= window.innerWidth'), true);
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = new URL('../test-artifacts/', import.meta.url); await mkdir(dir,{recursive:true});
  await writeFile(new URL('hosted-staff-mobile.png',dir),Buffer.from((await send('Page.captureScreenshot',{captureBeyondViewport:true},staffB)).data,'base64'));
  assert.deepEqual(errors, []); assert.deepEqual(localCalls, []);
  console.log('PASS: hosted mobile layout, no local API fallback, no uncaught browser errors');
} finally {
  try { await send('Browser.close'); } catch {}
  socket.close();
}
