import * as ExpoRouter from 'expo-router';

import CustomerEditScreen from '@/app/customers/[id]';
import CustomersScreen from '@/app/customers/index';
import HistoryScreen from '@/app/history/index';
import HomeScreen from '@/app/index';
import ProductsScreen from '@/app/products/index';
import SettingsScreen from '@/app/settings/index';
import WizardCustomerScreen from '@/app/wizard/customer';

import { renderScreen } from './renderScreen';

describe('main screen render snapshots', () => {
  it('app/index.tsx (home)', () => {
    expect(renderScreen(<HomeScreen />).toJSON()).toMatchSnapshot();
  });

  it('app/customers/index.tsx', () => {
    expect(renderScreen(<CustomersScreen />).toJSON()).toMatchSnapshot();
  });

  it('app/customers/[id].tsx', () => {
    jest.mocked(ExpoRouter.useLocalSearchParams).mockReturnValue({ id: 'cust_fixture_1' });
    expect(renderScreen(<CustomerEditScreen />).toJSON()).toMatchSnapshot();
  });

  it('app/history/index.tsx', () => {
    expect(renderScreen(<HistoryScreen />).toJSON()).toMatchSnapshot();
  });

  it('app/products/index.tsx', () => {
    expect(renderScreen(<ProductsScreen />).toJSON()).toMatchSnapshot();
  });

  it('app/settings/index.tsx', () => {
    expect(renderScreen(<SettingsScreen />).toJSON()).toMatchSnapshot();
  });

  it('app/wizard/customer.tsx (CustomerStep)', () => {
    expect(renderScreen(<WizardCustomerScreen />).toJSON()).toMatchSnapshot();
  });
});
