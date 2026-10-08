export const errorText = error => {
  const message = error?.error?.message || error?.message || 'This action could not be completed.';
  const labels = { observed_at: 'check time', obtainable_quantity: 'obtainable quantity', requested_quantity: 'requested quantity', product_id: 'medicine', unit: 'quantity unit' };
  const fields = (error?.error?.fields || []).map(field => labels[field]).filter(Boolean);
  return fields.length ? message + ' Check: ' + fields.join(', ') + '.' : message;
};
export const localInputTime = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const date = new Date(value);
  const part = number => String(number).padStart(2, '0');
  return date.getFullYear() + '-' + part(date.getMonth() + 1) + '-' + part(date.getDate()) + 'T' +
    part(date.getHours()) + ':' + part(date.getMinutes()) + ':' + part(date.getSeconds());
};
export const units = (quantity, unit) => quantity + ' ' + unit + (quantity === 1 ? '' : 's');
export const time = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value)) + ' (Dhaka)' : 'Time unknown';
export const titleFor = view => view.status === 'pending' ? 'Waiting for a pharmacy check' : view.answer.conclusion === 'sufficient' ? 'Enough at the time of the check' : view.answer.conclusion === 'insufficient' ? 'Not enough for this request' : 'The check is unresolved';

