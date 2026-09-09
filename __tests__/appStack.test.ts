jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: (payload: unknown) => ({ type: 'RESET', payload }),
  },
}));

import { CommonActions } from '@react-navigation/native';

import { resetToHistoryDetail, resetToHistoryList } from '../src/core/navigation/appStack';

describe('appStack', () => {
  test('resetToHistoryList keeps home under the history list', () => {
    const dispatch = jest.fn();
    resetToHistoryList({ dispatch });
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'index' }, { name: 'history/index' }],
      }),
    );
  });

  test('resetToHistoryDetail stacks home, history list and the saved calculation', () => {
    const dispatch = jest.fn();
    resetToHistoryDetail({ dispatch }, 'calc-1');
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({
        index: 2,
        routes: [
          { name: 'index' },
          { name: 'history/index' },
          { name: 'history/[id]', params: { id: 'calc-1', from: 'wizard' } },
        ],
      }),
    );
  });
});
