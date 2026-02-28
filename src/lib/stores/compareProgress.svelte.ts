/**
 * Shared reactive store for CompareModal background progress.
 * Allows ProcessingSettings to show progress even when the modal is closed.
 */

export const compareProgress = $state({
  running: false,
  progress: 0,
  total: 0,
});
