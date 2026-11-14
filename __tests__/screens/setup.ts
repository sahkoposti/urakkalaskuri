import { buildFixtureAppContext, mockDb } from './fixtures';

const mockFixtureApp = buildFixtureAppContext();

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: jest.fn(),
      back: jest.fn(),
      replace: jest.fn(),
      canGoBack: jest.fn(() => false),
    },
    Stack: {
      Screen: () => null,
    },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: jest.fn((effect: () => void | (() => void)) => {
      effect();
    }),
    Link: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.3.5' },
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'screen-snapshot-uuid',
}));

jest.mock('@react-native-community/slider', () => 'Slider');

jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Picker: Object.assign(
      ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'Picker' }, children),
      { Item: () => null },
    ),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    getParent: jest.fn(),
    dispatch: jest.fn(),
  }),
  useFocusEffect: jest.fn((effect: () => void | (() => void)) => {
    effect();
  }),
}));

jest.mock('@/src/hooks/useNativeRemovePrevention', () => ({
  useNativeRemovePrevention: () => ({
    applyPreventRemove: jest.fn(),
  }),
}));

jest.mock('@/src/context/SaveToastContext', () => ({
  useSaveToast: () => ({ showSaved: jest.fn() }),
}));

jest.mock('@/src/context/AppContext', () => {
  const actual = jest.requireActual('@/src/context/AppContext') as Record<string, unknown>;
  return {
    ...actual,
    useApp: () => mockFixtureApp,
    db: mockDb,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});
