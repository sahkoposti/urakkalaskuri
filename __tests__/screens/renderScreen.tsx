import type { ReactElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemedAlertProvider } from '@/src/context/ThemedAlertContext';
import { ThemeProvider } from '@/src/theme/ThemeContext';

export function renderScreen(element: ReactElement) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemedAlertProvider>
        <ThemeProvider>{element}</ThemeProvider>
      </ThemedAlertProvider>,
    );
  });
  return tree!;
}
