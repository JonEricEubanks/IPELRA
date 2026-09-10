import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useCountUp from './useCountUp';

describe('useCountUp', () => {
  it('returns the target immediately on first render (no animation from nothing)', () => {
    const { result } = renderHook(() => useCountUp(42));
    expect(result.current).toBe(42);
  });

  it('animates toward a new target when it changes', async () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, 50),
      { initialProps: { target: 0 } }
    );
    expect(result.current).toBe(0);

    rerender({ target: 10 });

    await waitFor(() => expect(result.current).toBe(10), { timeout: 1000 });
  });
});
