// App-wide registry for unsaved page edits. Pages with editable content
// register here; the UnsavedChangesGuard checks it before navigation leaves
// the page. Only one page is mounted at a time, so a single slot is enough.
let registration = null;

// `isDirty` returns whether there are unsaved edits; `save` persists them and
// returns a rejected promise on failure so the guard can keep the user on the page.
export function setUnsavedChanges({ isDirty, save }) {
  registration = { isDirty, save };
}

export function clearUnsavedChanges() {
  registration = null;
}

export function getUnsavedChanges() {
  return registration;
}