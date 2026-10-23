// Single Back entry point for every platform. The router installs the handler.
// Returns true when Back was handled in-app; false lets Android leave the app.
let handler: () => boolean = () => false;
export function setBackHandler(fn: () => boolean) {
  handler = fn;
}
export function onBack(): boolean {
  try {
    return handler();
  } catch (e) {
    console.warn('back handler failed', e);
    return true;
  }
}
