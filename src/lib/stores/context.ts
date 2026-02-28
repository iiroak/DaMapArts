/**
 * Svelte context helpers for sharing app state.
 */
import { getContext, setContext } from 'svelte';
import type { AppState } from './appState.svelte.js';
import { createAppState } from './appState.svelte.js';

const APP_STATE_KEY = Symbol('app-state');

/** Set the app state in component tree context (call in root layout) */
export function setAppState(): AppState {
  const state = createAppState();
  setContext(APP_STATE_KEY, state);
  return state;
}

/** Get the app state from context (call in any child component) */
export function getAppState(): AppState {
  return getContext<AppState>(APP_STATE_KEY);
}
