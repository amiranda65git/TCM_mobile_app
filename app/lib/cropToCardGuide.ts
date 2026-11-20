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
 */
export async function cropPhotoToCardGuide({
  photoPath,
  photoWidth,
  photoHeight,
  viewWidth,
  viewHeight,
  guideWidth,
  guideHeight,
}: CropParams): Promise<string> {
  if (
    !photoWidth ||
    !photoHeight ||
    !viewWidth ||
    !viewHeight ||
    !guideWidth ||
    !guideHeight
  ) {
    throw new Error('Dimensions invalides pour le crop');
  }

  const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;

  // Preview Vision Camera ≈ resizeMode "cover"
  const scale = Math.max(viewWidth / photoWidth, viewHeight / photoHeight);
  const displayedWidth = photoWidth * scale;
  const displayedHeight = photoHeight * scale;
  const offsetX = (displayedWidth - viewWidth) / 2;
  const offsetY = (displayedHeight - viewHeight) / 2;

  const guideLeft = (viewWidth - guideWidth) / 2;
  const guideTop = (viewHeight - guideHeight) / 2;

  let originX = (guideLeft + offsetX) / scale;
  let originY = (guideTop + offsetY) / scale;
  let width = guideWidth / scale;
  let height = guideHeight / scale;

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
    crop,
  });

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri;
}
