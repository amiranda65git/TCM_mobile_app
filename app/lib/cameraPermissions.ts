import { Camera } from 'expo-camera';

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function checkCameraPermission(): Promise<boolean> {
  const { status } = await Camera.getCameraPermissionsAsync();
  return status === 'granted';
}

// Export par défaut des fonctions liées aux permissions de caméra
export default {
  requestCameraPermission,
  checkCameraPermission
}; 