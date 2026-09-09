import { CommonActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

type Dispatchable = {
  dispatch: NavigationProp<ParamListBase>['dispatch'];
};

/** Etusivu pinon pohjalla, jotta historian takaisin-painike ei poistu sovelluksesta. */
export function resetToHistoryList(navigation: Dispatchable) {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [{ name: 'index' }, { name: 'history/index' }],
    }),
  );
}

/** Yhteenveto historian päällä, etusivu pohjalla. */
export function resetToHistoryDetail(navigation: Dispatchable, id: string) {
  navigation.dispatch(
    CommonActions.reset({
      index: 2,
      routes: [
        { name: 'index' },
        { name: 'history/index' },
        { name: 'history/[id]', params: { id, from: 'wizard' } },
      ],
    }),
  );
}
