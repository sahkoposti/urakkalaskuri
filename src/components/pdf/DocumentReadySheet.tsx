import { Text, View } from 'react-native';

import { OutlinedButton, PrimaryButton } from '@/src/components/common';
import {
  DOCUMENT_SAVED_IN_APP,
  documentPageCountLabel,
  documentReadyTitle,
  phoneSaveActionLabel,
  phoneSaveDetail,
  phoneStatusLabel,
} from '@/src/core/documents/documentLabels';
import type { PhonePlatform, PhoneSaveOutcome } from '@/src/core/documents/phoneSave';
import type { ExportedDocument } from '@/src/core/documents/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

import { DocumentFormModal } from './DocumentFormModal';

type DocumentReadySheetProps = {
  document: ExportedDocument | null;
  phone: PhoneSaveOutcome | null;
  platform: PhonePlatform;
  onPreview: () => void;
  onShare: () => void;
  onSaveToPhone: () => void;
  onClose: () => void;
};

export function DocumentReadySheet({
  document,
  phone,
  platform,
  onPreview,
  onShare,
  onSaveToPhone,
  onClose,
}: DocumentReadySheetProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <DocumentFormModal
      visible={document != null}
      title={document ? documentReadyTitle(document.kind) : ''}
      onClose={onClose}
      singleClose
    >
      {document ? (
        <View style={styles.body}>
          <Text style={styles.fileName}>{document.fileName}</Text>
          <Text style={styles.meta}>{documentPageCountLabel(document.numberOfPages)}</Text>
          <Text style={styles.saved}>{DOCUMENT_SAVED_IN_APP}</Text>
          {phone ? (
            <Text style={phone.status === 'failed' ? styles.error : styles.saved}>
              {phoneStatusLabel(phone.status, phone.error)}
            </Text>
          ) : null}
          {phone?.status === 'failed' && phoneSaveDetail(phone.error) ? (
            <Text style={styles.meta}>{phoneSaveDetail(phone.error)}</Text>
          ) : null}
          <PrimaryButton title="Esikatsele" onPress={onPreview} />
          {phone && phoneSaveActionLabel(phone.status, platform) ? (
            <OutlinedButton
              title={phoneSaveActionLabel(phone.status, platform) ?? ''}
              onPress={onSaveToPhone}
            />
          ) : null}
          <OutlinedButton title="Jaa" onPress={onShare} />
        </View>
      ) : null}
    </DocumentFormModal>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    body: {
      gap: 12,
    },
    fileName: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 16,
      color: colors.primary,
    },
    meta: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
      color: colors.text,
    },
    saved: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
      color: colors.text,
      marginBottom: 4,
    },
    error: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
      color: colors.accent,
    },
  };
}
