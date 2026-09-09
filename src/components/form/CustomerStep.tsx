import { Pressable, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { AppInput } from '@/src/components/common';
import {
  lookupPostalLocality,
  normalizePostalCode,
} from '@/src/core/customer/varsinaisSuomiPostalCodes';
import type { CustomerType } from '@/src/core/models/types';
import type { CustomerRecord } from '@/src/core/structure/types';
import { customerMatchLabel, formatCustomerType } from '@/src/core/customer/customerRegister';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type CustomerStepProps = {
  name: string;
  customerType: CustomerType;
  reverseVat: boolean;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  postalLocality: string;
  notes: string;
  onNameChange: (value: string) => void;
  onCustomerTypeChange: (value: CustomerType) => void;
  onReverseVatChange: (value: boolean) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onPostalLocalityChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  nameMatches?: CustomerRecord[];
  onPickCustomer?: (customer: CustomerRecord) => void;
};

export function CustomerStep({
  name,
  customerType,
  reverseVat,
  phone,
  email,
  address,
  postalCode,
  postalLocality,
  notes,
  onNameChange,
  onCustomerTypeChange,
  onReverseVatChange,
  onPhoneChange,
  onEmailChange,
  onAddressChange,
  onPostalCodeChange,
  onPostalLocalityChange,
  onNotesChange,
  nameMatches = [],
  onPickCustomer,
}: CustomerStepProps) {
  const styles = useThemedStyles(createStyles);

  function handlePostalCodeChange(value: string) {
    const code = normalizePostalCode(value);
    onPostalCodeChange(code);
    const locality = lookupPostalLocality(code);
    if (locality) {
      onPostalLocalityChange(locality);
    }
  }

  return (
    <View>
      <AppInput label="Nimi *" value={name} onChangeText={onNameChange} />
      {nameMatches.length > 0 && onPickCustomer ? (
        <View style={styles.matches}>
          {nameMatches.map((customer) => (
            <Pressable
              key={customer.id}
              onPress={() => onPickCustomer(customer)}
              style={({ pressed }) => [styles.matchRow, pressed && styles.matchRowPressed]}
            >
              <Text style={styles.matchText}>{customerMatchLabel(customer)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
        label="Postinumero"
        value={postalCode}
        onChangeText={handlePostalCodeChange}
        keyboardType="numeric"
        placeholder="Esim. 20100"
      />
      <AppInput
        label="Postitoimipaikka"
        value={postalLocality}
        onChangeText={onPostalLocalityChange}
        placeholder="Täyttyy postinumerosta"
      />
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
          { label: formatCustomerType('private'), value: 'private' },
          { label: formatCustomerType('business'), value: 'business' },
        ]}
      />
      {customerType === 'business' ? (
        <ChoiceToggle
          label="Käänteinen arvonlisävero"
          value={reverseVat}
          options={[
            { value: true, label: 'Kyllä' },
            { value: false, label: 'Ei' },
          ]}
          onChange={onReverseVatChange}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    matches: {
      marginTop: -6,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.secondary,
      overflow: 'hidden' as const,
    },
    matchRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    matchRowPressed: {
      opacity: 0.75,
    },
    matchText: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
  };
}
