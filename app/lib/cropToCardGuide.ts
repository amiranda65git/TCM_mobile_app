import * as ImageManipulator from 'expo-image-manipulator';

type CropParams = {
  photoPath: string;
  photoWidth: number;
  photoHeight: number;
  viewWidth: number;
  viewHeight: number;
  guideWidth: number;
  guideHeight: number;
};

/**
 * Recadre la photo aux proportions du cadre guide (preview en mode cover).
 *
 * Important : VisionCamera renvoie width/height du buffer brut (souvent paysage + EXIF),
 * alors qu'ImageManipulator/Glide charge l'image déjà orientée. On normalise d'abord
 * pour calculer le crop sur les vraies dimensions manipulables.
 */
export async function cropPhotoToCardGuide({
  photoPath,
  viewWidth,
  viewHeight,
  guideWidth,
  guideHeight,
}: CropParams): Promise<string> {
  if (!viewWidth || !viewHeight || !guideWidth || !guideHeight) {
    throw new Error('Dimensions invalides pour le crop');
  }

  const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;

  // Bake EXIF → pixels + dimensions réelles utilisées par le crop
  const upright = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  const photoWidth = upright.width;
  const photoHeight = upright.height;
  if (!photoWidth || !photoHeight) {
    throw new Error('Dimensions photo invalides après normalisation');
  }

  // Preview Vision Camera ≈ resizeMode "cover"
  const scale = Math.max(viewWidth / photoWidth, viewHeight / photoHeight);
  const displayedWidth = photoWidth * scale;
  const displayedHeight = photoHeight * scale;
  const offsetX = (displayedWidth - viewWidth) / 2;
  const offsetY = (displayedHeight - viewHeight) / 2;

  // Guide centré ; borné à la zone visible si plus grand que la preview
  const clampedGuideW = Math.min(guideWidth, viewWidth);
  const clampedGuideH = Math.min(guideHeight, viewHeight);
  const guideLeft = (viewWidth - clampedGuideW) / 2;
  const guideTop = (viewHeight - clampedGuideH) / 2;

  let originX = (guideLeft + offsetX) / scale;
  let originY = (guideTop + offsetY) / scale;
  let width = clampedGuideW / scale;
  let height = clampedGuideH / scale;

  originX = Math.max(0, Math.min(originX, photoWidth - 1));
  originY = Math.max(0, Math.min(originY, photoHeight - 1));
  width = Math.max(1, Math.min(width, photoWidth - originX));
  height = Math.max(1, Math.min(height, photoHeight - originY));

  const crop = {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(width),
    height: Math.round(height),
  };

  console.log('[Scan] Crop guide:', {
    photo: `${photoWidth}x${photoHeight}`,
    view: `${viewWidth}x${viewHeight}`,
    guide: `${clampedGuideW}x${clampedGuideH}`,
    crop,
  });

  const result = await ImageManipulator.manipulateAsync(
    upright.uri,
    [{ crop }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri;
}
