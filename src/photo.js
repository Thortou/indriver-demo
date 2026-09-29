/* =============================================================================
   photo.js — take or choose a document photo, then downscale it to about
   2000 px on the long edge as JPEG before upload (DRIVER_APP_API.md §2.1).
   ========================================================================== */

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { t } from './i18n';

const LONG_EDGE = 2000;

async function launch(source) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    return ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  }
  return ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
}

async function downscale(asset) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const { width = 0, height = 0 } = asset;
  if (Math.max(width, height) > LONG_EDGE) {
    ctx.resize(width >= height ? { width: LONG_EDGE } : { height: LONG_EDGE });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

/** Ask camera or library, then return a downscaled JPEG uri (or null). */
export function pickPhoto({ selfie } = {}) {
  return new Promise((resolve) => {
    const go = async (source) => {
      try {
        const res = await launch(source);
        if (!res || res.canceled || !res.assets || !res.assets[0]) return resolve(null);
        resolve(await downscale(res.assets[0]));
      } catch {
        resolve(null);
      }
    };
    Alert.alert(
      selfie ? t('doc_license_selfie') : t('takePhoto'),
      undefined,
      [
        { text: t('takePhoto'), onPress: () => go('camera') },
        { text: t('chooseFromLibrary'), onPress: () => go('library') },
        { text: t('cancel'), style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}
