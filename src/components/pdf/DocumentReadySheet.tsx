import { Text, View } from 'react-native';

import { OutlinedButton, PrimaryButton } from '@/src/components/common';
import {
  DOCUMENT_SAVED_IN_APP,
  documentPageCountLabel,
  documentReadyTitle,
} from '@/src/core/documents/documentLabels';
import type { ExportedDocument } from '@/src/core/documents/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

import { DocumentFormModal } from './DocumentFormModal';

type DocumentReadySheetProps = {
  document: ExportedDocument | null;
  onPreview: () => void;
  onShare: () => void;
  onClose: () => void;
};

export function DocumentReadySheet({ document, onPreview, onShare, onClose }: DocumentReadySheetProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <DocumentFormModal
      visible={document != null}
      title={document ? documentReadyTitle(document.kind) : ''}
      onClose={onClose}
    >
      {document ? (
        <View style={styles.body}>
          <Text style={styles.fileName}>{document.fileName}</Text>
          <Text style={styles.meta}>{documentPageCountLabel(document.numberOfPages)}</Text>
          <Text style={styles.saved}>{DOCUMENT_SAVED_IN_APP}</Text>
          <PrimaryButton title="Esikatsele" onPress={onPreview} />
          <OutlinedButton title="Jaa" onPress={onShare} />
          <OutlinedButton title="Sulje" onPress={onClose} />
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
  };
}
