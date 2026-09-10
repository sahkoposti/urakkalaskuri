import { HeaderBackButton, type HeaderBackButtonProps } from '@react-navigation/elements';

/** Otsikon Takaisin + ele: kaikki poistumiset kulkevat onBackin kautta. */
export function exitStackScreenOptions(onBack: () => void, preventGesture: boolean) {
  return {
    gestureEnabled: !preventGesture,
    fullScreenGestureEnabled: !preventGesture,
    headerBackButtonMenuEnabled: false,
    headerBackVisible: false,
    headerLeft: (props: HeaderBackButtonProps) => (
      <HeaderBackButton {...props} onPress={onBack} />
    ),
  };
}
