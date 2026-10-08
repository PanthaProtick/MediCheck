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
const newPage = async (role = 'caregiver') => {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: origin + '?role=' + role }, sessionId);
  await wait(sessionId, role === 'staff' ? '!!document.getElementById("staff-token-input")' : '!!document.getElementById("submit-enquiry-btn") && !document.querySelector("fieldset").disabled');
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
  const staff = await newPage('staff');
  assert.equal(await evaluate(staff, '!!document.getElementById("submit-enquiry-btn")'), false);
  assert.equal(await evaluate(caregiver, '!!document.getElementById("staff-token-input")'), false);
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const enquiryId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  assert.equal(await evaluate(staff, 'document.getElementById("staff-token-input").value'), '');
  await setInput(staff, 'staff-token-input', 'browser-test-only-token');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, `!!Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(enquiryId)}))`);
  await evaluate(staff, `Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(enquiryId)})).click()`);
  await wait(staff, '!!document.getElementById("submit-observation-btn")');
  await setInput(staff, 'obtainable-count-input', '4');
  await evaluate(staff, `Array.from(document.querySelectorAll('button')).find(node => node.textContent.includes('Set simulated check time to now')).click()`);
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Not enough for this request")');
  assert.match(await body(caregiver), /Discrepancy: -8/);
  assert.match(await body(caregiver), /Exact request: Demo Medicine A/);
  console.log('PASS: separate caregiver/staff contexts, explicit credential, persisted golden mismatch');

  // Fail one response after the real server accepted the report; inspect must recover without a second PUT.
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const lostId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, `!!Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(lostId)}))`);
  await evaluate(staff, `Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(lostId)})).click()`);
  await wait(staff, '!!document.getElementById("submit-observation-btn")');
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
  assert.equal(await evaluate(staff, 'document.getElementById("submit-observation-btn").matches(":disabled")'), true);
  // Reload must retain the intent without retaining the credential.
  await send('Page.reload', {}, staff);
  await wait(staff, 'document.body.innerText.includes("unfinished save intent was recovered")');
  await evaluate(staff, `Array.from(document.querySelectorAll('button')).find(node => node.textContent === 'Inspect saved outcome').click()`);
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
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
  // An unsent report remains frozen through reload, missing credentials and rejected retries.
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const retryId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await setInput(staff, 'staff-token-input', 'browser-test-only-token');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, `!!Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(retryId)}))`);
  await evaluate(staff, `Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(retryId)})).click()`);
  await setInput(staff, 'obtainable-count-input', '8');
  await evaluate(staff, `document.getElementById('time-unknown-input').click()`);
  const rejectRequest = event => {
    if (event.sessionId === staff && event.method === 'Fetch.requestPaused')
      send('Fetch.failRequest', { requestId: event.params.requestId, errorReason: 'Failed' }, staff);
  };
  events.add(rejectRequest);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*observation', requestStage: 'Request' }] }, staff);
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Save outcome requires inspection")');
  await send('Fetch.disable', {}, staff);
  events.delete(rejectRequest);
  await send('Page.reload', {}, staff);
  await wait(staff, 'document.body.innerText.includes("unfinished save intent was recovered")');
  assert.equal(await evaluate(staff, 'document.getElementById("staff-token-input").value'), '');
  const pressByText = text => evaluate(staff, `Array.from(document.querySelectorAll('button')).find(node => node.textContent === ${JSON.stringify(text)}).click()`);
  await pressByText('Inspect saved outcome');
  await wait(staff, 'document.body.innerText.includes("Retry identical save")');
  await pressByText('Retry identical save');
  await wait(staff, 'document.body.innerText.includes("Re-enter your pharmacy access key")');
  assert.equal(await evaluate(staff, '!!document.querySelector(".recovery-panel")'), true);
  await setInput(staff, 'staff-token-input', 'incorrect-key');
  await pressByText('Retry identical save');
  await wait(staff, 'document.body.innerText.includes("Save outcome requires inspection") && !document.getElementById("staff-token-input").disabled');
  assert.equal(await evaluate(staff, '!!document.querySelector(".recovery-panel")'), true);
  await setInput(staff, 'staff-token-input', 'browser-test-only-token');
  await pressByText('Inspect saved outcome');
  await wait(staff, 'document.body.innerText.includes("Retry identical save")');
  await pressByText('Retry identical save');
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("observation time is unknown")');
  assert.match(await body(caregiver), /8 tablets/);
  assert.match(await body(caregiver), /The check is unresolved/);
  console.log('PASS: rejected retries preserve uncertain intent; unknown time stays unresolved');

  // Explicit unable-to-check report; distinct from a zero count.
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Waiting for a pharmacy check")');
  const unableId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, `!!Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(unableId)}))`);
  await evaluate(staff, `Array.from(document.querySelectorAll('.queue-item')).find(node => node.textContent.includes(${JSON.stringify(unableId)})).click()`);
  await evaluate(staff, 'document.querySelectorAll("input[name=report-kind]")[1].click()');
  assert.equal(await evaluate(staff, '!!document.getElementById("obtainable-count-input")'), false);
  await click(staff, 'submit-observation-btn');
  await wait(staff, 'document.body.innerText.includes("Report Accepted")');
  await click(caregiver, 'refresh-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Staff could not complete the check")');
  assert.match(await body(caregiver), /Not established/);
  console.log('PASS: inability to check cannot be mistaken for zero stock');
  await send('Page.reload', {}, caregiver);
  await wait(caregiver, 'document.body.innerText.includes("Staff could not complete the check")');
  assert.equal(await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")'), unableId);
  await setInput(staff, 'staff-token-input', 'incorrect-key');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, '!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate(staff, 'document.querySelectorAll(".queue-item").length'), 0);
  assert.equal(await evaluate(staff, '!!document.getElementById("submit-observation-btn")'), false);
  console.log('PASS: invalid access key hides queue and report controls; caregiver enquiry survives reload');

  // Verify narrow layouts and save screenshots for visual review.
  const { mkdir, writeFile } = await import('node:fs/promises');
  const artifactDir = new URL('../test-artifacts/', import.meta.url);
  await mkdir(artifactDir, { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, caregiver);
  await writeFile(new URL('caregiver-desktop.png', artifactDir), Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true }, caregiver)).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, caregiver);
  assert.equal(await evaluate(caregiver, 'document.documentElement.scrollWidth <= window.innerWidth'), true);
  await writeFile(new URL('caregiver-mobile.png', artifactDir), Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true }, caregiver)).data, 'base64'));
  await setInput(staff, 'staff-token-input', 'browser-test-only-token');
  await click(staff, 'refresh-queue-btn');
  await wait(staff, 'document.body.innerText.includes("No pending requests")');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, staff);
  await writeFile(new URL('staff-desktop.png', artifactDir), Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true }, staff)).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, staff);
  assert.equal(await evaluate(staff, 'document.documentElement.scrollWidth <= window.innerWidth'), true);
  console.log('PASS: caregiver and staff screens fit a 390px viewport');

  // Lost enquiry-create response survives reload and inspection without another write.
  let createDropped = false;
  let createWrites = 0;
  const loseCreate = event => {
    if (event.sessionId === caregiver && event.method === 'Network.requestWillBeSent' && event.params.request.method === 'PUT') createWrites++;
    if (event.sessionId === caregiver && event.method === 'Fetch.requestPaused') {
      if (!createDropped && event.params.responseStatusCode === 201) {
        createDropped = true;
        send('Fetch.failRequest', { requestId: event.params.requestId, errorReason: 'Failed' }, caregiver);
      } else send('Fetch.continueRequest', { requestId: event.params.requestId }, caregiver);
    }
  };
  events.add(loseCreate);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*api/v1/enquiries/*', requestStage: 'Response' }] }, caregiver);
  await click(caregiver, 'submit-enquiry-btn');
  await wait(caregiver, 'document.body.innerText.includes("Save outcome requires inspection")');
  const createId = await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")');
  assert.equal(createDropped, true);
  await send('Page.reload', {}, caregiver);
  await wait(caregiver, 'document.body.innerText.includes("unfinished save intent was recovered")');
  await evaluate(caregiver, 'Array.from(document.querySelectorAll("button")).find(node => node.textContent === "Inspect saved outcome").click()');
  await wait(caregiver, '!document.querySelector(".recovery-panel") && document.body.innerText.includes("Waiting for a pharmacy check")');
  assert.equal(createWrites, 1);
  assert.equal(await evaluate(caregiver, 'new URL(location.href).searchParams.get("enquiry")'), createId);
  await send('Fetch.disable', {}, caregiver);
  events.delete(loseCreate);
  console.log('PASS: lost enquiry-create response survives reload without duplicate creation');
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);
  console.log('PASS: no external runtime HTTP requests and no uncaught browser errors');
} finally {
  try { await send('Browser.close'); } catch { /* Browser may have already closed. */ }
  socket.close();
}
