jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid',
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    constructor() {
      this.uri = 'file://mock-attachment';
      this.exists = false;
    }
    copy() {}
    delete() {}
  }
  return {
    File: MockFile,
    Directory: class {},
    Paths: { document: '/mock-documents' },
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(),
  ImageManipulator: class {},
}));
