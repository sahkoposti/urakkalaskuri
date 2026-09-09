import { useState } from 'react';

import type { CustomerInfo, CustomerType } from '@/src/core/models/types';
import type { CustomerRecord } from '@/src/core/structure/types';
import { customerRecordToInfo } from '@/src/core/structure/types';

type CustomerFormSeed = {
  id?: string;
  name?: string;
  customerType?: CustomerType;
  reverseVat?: boolean;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  postalLocality?: string;
  notes?: string;
};

export function useCustomerFormState(initial?: CustomerFormSeed) {
  const [customerId, setCustomerId] = useState(initial?.id);
  const [name, setName] = useState(initial?.name ?? '');
  const [customerType, setCustomerType] = useState<CustomerType>(initial?.customerType ?? 'private');
  const [reverseVat, setReverseVat] = useState(initial?.reverseVat ?? false);
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [postalLocality, setPostalLocality] = useState(initial?.postalLocality ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function applyCustomer(record: CustomerRecord) {
    const info = customerRecordToInfo(record);
    setCustomerId(record.id);
    setName(info.name);
    setCustomerType(info.customerType ?? 'private');
    setReverseVat(Boolean(info.reverseVat));
    setPhone(info.phone ?? '');
    setEmail(info.email ?? '');
    setAddress(info.address ?? '');
    setPostalCode(info.postalCode ?? '');
    setPostalLocality(info.postalLocality ?? '');
    setNotes(info.notes ?? '');
  }

  function applySeed(seed: CustomerFormSeed) {
    if (seed.id !== undefined) setCustomerId(seed.id);
    if (seed.name !== undefined) setName(seed.name);
    if (seed.customerType !== undefined) setCustomerType(seed.customerType);
    if (seed.reverseVat !== undefined) setReverseVat(seed.reverseVat);
    if (seed.phone !== undefined) setPhone(seed.phone);
    if (seed.email !== undefined) setEmail(seed.email);
    if (seed.address !== undefined) setAddress(seed.address);
    if (seed.postalCode !== undefined) setPostalCode(seed.postalCode);
    if (seed.postalLocality !== undefined) setPostalLocality(seed.postalLocality);
    if (seed.notes !== undefined) setNotes(seed.notes);
  }

  function buildInfo(): CustomerInfo {
    return {
      name: name.trim(),
      customerType,
      reverseVat: customerType === 'business' ? reverseVat : false,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      postalLocality: postalLocality.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  function handleCustomerTypeChange(type: CustomerType) {
    setCustomerType(type);
    if (type === 'private') setReverseVat(false);
  }

  const customerStepProps = {
    name,
    customerType,
    reverseVat,
    phone,
    email,
    address,
    postalCode,
    postalLocality,
    notes,
    onNameChange: setName,
    onCustomerTypeChange: handleCustomerTypeChange,
    onReverseVatChange: setReverseVat,
    onPhoneChange: setPhone,
    onEmailChange: setEmail,
    onAddressChange: setAddress,
    onPostalCodeChange: setPostalCode,
    onPostalLocalityChange: setPostalLocality,
    onNotesChange: setNotes,
  };

  return {
    customerId,
    setCustomerId,
    applyCustomer,
    applySeed,
    buildInfo,
    customerStepProps,
  };
}
