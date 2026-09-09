import { createElement, useEffect, useRef } from 'react';
import { Platform, TextInput, type StyleProp, type TextStyle } from 'react-native';

type JsonImportFieldProps = {
  fieldKey: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  placeholderColor: string;
  textColor: string;
  style: StyleProp<TextStyle>;
};

const MAX_JSON_LENGTH = 5_000_000;

/** Ei-kontrolloitu kenttä: iso liitos ei katoa React-staten kautta. */
export function JsonImportField({
  fieldKey,
  onChangeText,
  placeholder,
  placeholderColor,
  textColor,
  style,
}: JsonImportFieldProps) {
  const latest = useRef(onChangeText);
  useEffect(() => {
    latest.current = onChangeText;
  }, [onChangeText]);

  function setText(text: string) {
    latest.current(text);
  }

  if (Platform.OS === 'web') {
    return createElement('textarea', {
      key: fieldKey,
      onChange: (event: { currentTarget: { value: string } }) => {
        setText(event.currentTarget.value);
      },
      spellCheck: false,
      autoComplete: 'off',
      autoCorrect: 'off',
      placeholder,
      style: {
        width: '100%',
        height: '100%',
        minHeight: 120,
        resize: 'none',
        padding: 10,
        margin: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: textColor,
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 13,
        boxSizing: 'border-box',
      },
    });
  }

  return (
    <TextInput
      key={fieldKey}
      style={style}
      defaultValue=""
      onChangeText={setText}
      onChange={(event) => {
        const text = event.nativeEvent.text;
        if (typeof text === 'string') setText(text);
      }}
      multiline
      scrollEnabled
      maxLength={MAX_JSON_LENGTH}
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      textAlignVertical="top"
    />
  );
}
