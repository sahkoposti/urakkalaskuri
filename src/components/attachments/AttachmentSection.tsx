import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { ReorderControls } from '@/src/components/ReorderControls';
import { AppInput, OutlinedButton, SectionTitle } from '@/src/components/common';
import { addPickedAttachment } from '@/src/core/attachments/addPickedAttachment';
import { attachmentDestinationCounts } from '@/src/core/attachments/attachmentCounts';
import { attachmentFileUri } from '@/src/core/attachments/attachmentFiles';
import {
  ATTACHMENT_ADD_LABEL,
  ATTACHMENT_CAMERA_DENIED_MESSAGE,
  attachmentFormCountLabel,
} from '@/src/core/attachments/attachmentMessages';
import { clampCaption } from '@/src/core/attachments/attachmentCaption';
import {
  moveAttachment,
  removeAttachment,
  updateAttachment,
} from '@/src/core/attachments/attachmentsRepository';
import type { PickedAttachment } from '@/src/core/attachments/ingestAttachment';
import type { Attachment, AttachmentDestination } from '@/src/core/attachments/types';
import { ATTACHMENT_CAPTION_MAX } from '@/src/core/attachments/types';
import type { CalculationRecord } from '@/src/core/models/types';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

const DESTINATIONS: { value: AttachmentDestination; label: string }[] = [
  { value: 'offer', label: 'Tarjous' },
  { value: 'card', label: 'Urakkakortti' },
  { value: 'both', label: 'Molemmat' },
  { value: 'none', label: 'Ei kumpaankaan' },
];

type AttachmentSectionProps = {
  record: CalculationRecord;
  attachments: readonly Attachment[];
  onChanged: () => void;
  onRecordChange: (record: CalculationRecord) => void;
};

export function AttachmentSummaryLink({
  attachments,
  target,
  onPress,
}: {
  attachments: readonly Attachment[];
  target: 'offer' | 'card';
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const counts = attachmentDestinationCounts(attachments);
  const count = target === 'offer' ? counts.offer : counts.card;
  const label = attachmentFormCountLabel(count);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.summary}>{label}</Text>
    </Pressable>
  );
}

export function AttachmentSection({
  record,
  attachments,
  onChanged,
}: AttachmentSectionProps) {
  const styles = useThemedStyles(createStyles);
  const { showAlert } = useThemedAlert();
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  async function runAdds(picks: PickedAttachment[]) {
    if (picks.length === 0) return;
    setBusy(true);
    const messages: string[] = [];
    try {
      for (const picked of picks) {
        const result = await addPickedAttachment(record.id, picked);
        if (!result.ok) messages.push(result.message);
      }
      onChanged();
    } finally {
      setBusy(false);
    }
    if (messages.length > 0) showAlert('Liite', messages.join('\n'));
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Kamera', ATTACHMENT_CAMERA_DENIED_MESSAGE);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;
    await runAdds(result.assets.map(fromImageAsset));
  }

  async function pickGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    await runAdds(result.assets.map(fromImageAsset));
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    await runAdds(result.assets.map(fromDocumentAsset));
  }

  return (
    <View style={styles.section}>
      <SectionTitle title="Liitteet" />
      {attachments.length === 0 ? <Text style={styles.note}>Ei liitteitä.</Text> : null}
      {attachments.map((item, index) => (
        <AttachmentRow
          key={item.id}
          item={item}
          index={index}
          count={attachments.length}
          onChanged={onChanged}
          onDelete={() => setPendingDelete(item)}
          onError={(message) => showAlert('Liite', message)}
        />
      ))}
      <OutlinedButton title={ATTACHMENT_ADD_LABEL} onPress={() => setSourceOpen(true)} disabled={busy} />
      <ConfirmDialog
        visible={sourceOpen}
        title={ATTACHMENT_ADD_LABEL}
        message="Valitse, mistä liite lisätään."
        onClose={() => setSourceOpen(false)}
        buttons={[
          {
            title: 'Ota kuva',
            variant: 'primary',
            onPress: () => {
              setSourceOpen(false);
              void takePhoto();
            },
          },
          {
            title: 'Valitse kuvia',
            variant: 'outlined',
            onPress: () => {
              setSourceOpen(false);
              void pickGallery();
            },
          },
          {
            title: 'Valitse tiedosto',
            variant: 'outlined',
            onPress: () => {
              setSourceOpen(false);
              void pickDocument();
            },
          },
          { title: 'Peruuta', variant: 'outlined', onPress: () => setSourceOpen(false) },
        ]}
      />
      <ConfirmDialog
        visible={pendingDelete != null}
        title="Poista liite?"
        message="Poistetaanko liite? Tätä ei voi perua."
        onClose={() => setPendingDelete(null)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setPendingDelete(null) },
          {
            title: 'Poista',
            variant: 'destructive',
            onPress: () => {
              const target = pendingDelete;
              setPendingDelete(null);
              if (!target) return;
              void removeAttachment(target.id).then(onChanged).catch((error: unknown) => {
                console.error(error);
                showAlert('Liite', 'Liitteen poistaminen epäonnistui.');
              });
            },
          },
        ]}
      />
    </View>
  );
}

function AttachmentRow({
  item,
  index,
  count,
  onChanged,
  onDelete,
  onError,
}: {
  item: Attachment;
  index: number;
  count: number;
  onChanged: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [caption, setCaption] = useState(item.caption);
  useEffect(() => {
    setCaption(item.caption);
  }, [item.caption]);
  const thumb = item.kind === 'image' ? safeThumb(item) : null;

  async function saveCaption() {
    const next = clampCaption(caption).trim();
    if (next === item.caption) return;
    try {
      await updateAttachment(item.id, { caption: next });
      onChanged();
    } catch (error) {
      console.error(error);
      onError(error instanceof Error ? error.message : 'Kuvatekstiä ei voitu tallentaa.');
    }
  }

  return (
    <View style={styles.row}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.pdfIcon}>
          <Text style={styles.pdfLabel}>PDF</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <AppInput
          label="Kuvateksti"
          value={caption}
          onChangeText={(value) => setCaption(clampCaption(value))}
          onBlur={() => {
            void saveCaption();
          }}
          kind="sentence"
          compact
          placeholder={`Enintään ${ATTACHMENT_CAPTION_MAX} merkkiä`}
        />
        <AppPicker
          label="Kohde"
          selectedValue={item.destination}
          items={DESTINATIONS}
          onValueChange={(value) => {
            void updateAttachment(item.id, { destination: value as AttachmentDestination })
              .then(onChanged)
              .catch((error: unknown) => {
                console.error(error);
                onError('Kohdetta ei voitu vaihtaa.');
              });
          }}
        />
        <ReorderControls
          index={index}
          count={count}
          onMove={(direction) => {
            void moveAttachment(item.id, direction < 0 ? 'up' : 'down').then(onChanged);
          }}
          onDelete={onDelete}
        />
      </View>
    </View>
  );
}

function fromImageAsset(asset: ImagePicker.ImagePickerAsset): PickedAttachment {
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'kuva.jpg',
    mime: asset.mimeType ?? 'image/jpeg',
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

function fromDocumentAsset(asset: DocumentPicker.DocumentPickerAsset): PickedAttachment {
  return {
    uri: asset.uri,
    name: asset.name,
    mime: asset.mimeType ?? '',
    width: null,
    height: null,
  };
}

function safeThumb(item: Attachment): string | null {
  try {
    return attachmentFileUri(item.fileRelPath);
  } catch {
    return null;
  }
}

function createStyles(colors: AppColorPalette) {
  return {
    section: {
      gap: 12,
    },
    summary: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
      color: colors.primary,
    },
    note: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
    row: {
      flexDirection: 'row' as const,
      gap: 12,
      alignItems: 'flex-start' as const,
    },
    rowBody: {
      flex: 1,
      gap: 8,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 5,
      backgroundColor: colors.surface,
    },
    pdfIcon: {
      width: 56,
      height: 56,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.surface,
    },
    pdfLabel: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 12,
      color: colors.accent,
    },
  };
}
