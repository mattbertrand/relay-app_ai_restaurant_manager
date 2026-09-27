// App-wide registry for unsaved page edits. Pages with editable content
// register here; the UnsavedChangesGuard checks it before navigation leaves
// the page. Only one page is mounted at a time, so a single slot is enough.
let registration = null;
const listeners = new Set();

function notify() {
  listeners.forEach((l) => l(registration));
}

// `isDirty` returns whether there are unsaved edits; `save` persists them and
// returns a rejected promise on failure so the guard can keep the user on the page.
export function setUnsavedChanges({ isDirty, save }) {
  registration = { isDirty, save };
  notify();
}

export function clearUnsavedChanges() {
  registration = null;
  notify();
}

export function getUnsavedChanges() {
  return registration;
}

// Lets the guard react the moment a page becomes dirty (or clean) — used to
// protect the browser Back button while there are unsaved edits.
export function onUnsavedChangesChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}