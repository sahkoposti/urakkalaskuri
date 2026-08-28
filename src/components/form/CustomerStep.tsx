import { Pressable, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { AppInput } from '@/src/components/common';
import type { CustomerType } from '@/src/core/models/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type CustomerStepProps = {
  name: string;
  customerType: CustomerType;
  reverseVat: boolean;
  phone: string;
  email: string;
  address: string;
  notes: string;
  onNameChange: (value: string) => void;
  onCustomerTypeChange: (value: CustomerType) => void;
  onReverseVatChange: (value: boolean) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export function CustomerStep({
  name,
  customerType,
  reverseVat,
  phone,
  email,
  address,
  notes,
  onNameChange,
  onCustomerTypeChange,
  onReverseVatChange,
  onPhoneChange,
  onEmailChange,
  onAddressChange,
  onNotesChange,
}: CustomerStepProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View>
      <AppInput label="Nimi *" value={name} onChangeText={onNameChange} />
      <AppInput
        label="Puh."
        value={phone}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
      />
      <AppInput
        label="Sähköposti"
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
      />
      <AppInput label="Osoite" value={address} onChangeText={onAddressChange} />
      <AppInput
        label="Lisätiedot"
        value={notes}
        onChangeText={onNotesChange}
        multiline
        placeholder="Valinnainen"
      />
      <AppPicker
        label="Asiakastyyppi"
        selectedValue={customerType}
        onValueChange={(value) => onCustomerTypeChange(value as CustomerType)}
        items={[
          { label: 'Yksityisasiakas', value: 'private' },
          { label: 'Yritysasiakas', value: 'business' },
        ]}
      />
      {customerType === 'business' ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Käänteinen arvonlisävero</Text>
          <View style={styles.toggleActions}>
            <Pressable
              style={[
                styles.toggleButton,
                reverseVat && styles.toggleButtonActive,
              ]}
              onPress={() => onReverseVatChange(true)}
            >
              <Text style={[styles.toggleButtonText, reverseVat && styles.toggleButtonTextActive]}>
                Kyllä
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                !reverseVat && styles.toggleButtonActive,
              ]}
              onPress={() => onReverseVatChange(false)}
            >
              <Text
                style={[styles.toggleButtonText, !reverseVat && styles.toggleButtonTextActive]}
              >
                Ei
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    toggleRow: {
      marginBottom: 12,
    },
    toggleLabel: {
      marginBottom: 6,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
    toggleActions: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    toggleButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      paddingVertical: 12,
      alignItems: 'center' as const,
      backgroundColor: colors.secondary,
    },
    toggleButtonActive: {
      backgroundColor: colors.accent,
    },
    toggleButtonText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
    },
    toggleButtonTextActive: {
      color: colors.secondary,
    },
  };
}
