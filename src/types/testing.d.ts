declare module '@testing-library/react';
declare module '@testing-library/user-event';
declare module '@testing-library/jest-dom';
declare module 'vitest';

// Provide minimal globals for Vitest to keep the TS language server happy.
interface ImportMetaEnv {}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
