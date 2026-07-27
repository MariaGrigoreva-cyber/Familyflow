import React from 'react';
import { render, screen } from '@testing-library/react';
import { SplashScreen } from './SplashScreen';

test('показывает название приложения и подпись', () => {
  render(<SplashScreen />);
  expect(screen.getByText('Семейный поток')).toBeInTheDocument();
  expect(screen.getByText('ФИНАНСОВЫЙ ДИРЕКТОР СЕМЬИ')).toBeInTheDocument();
});
