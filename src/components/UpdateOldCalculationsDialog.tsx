import { ConfirmDialog } from '@/src/components/ConfirmDialog';

type UpdateOldCalculationsDialogProps = {
  visible: boolean;
  onClose: () => void;
  onKeepOld: () => void;
  onUpdate: () => void;
};

export function UpdateOldCalculationsDialog({
  visible,
  onClose,
  onKeepOld,
  onUpdate,
}: UpdateOldCalculationsDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title="Päivitetäänkö vanhat laskelmat?"
      message="Päivitetäänkö tämän asiakkaan vanhat laskelmat?"
      onClose={onClose}
      buttons={[
        {
          title: 'Ei',
          variant: 'outlined',
          onPress: onKeepOld,
        },
        {
          title: 'Kyllä',
          variant: 'primary',
          onPress: onUpdate,
        },
      ]}
    />
  );
}
