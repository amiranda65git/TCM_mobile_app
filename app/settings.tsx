import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  SafeAreaView,
  Platform,
  Linking,
  StatusBar
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  supabase, 
  initAvatarBucket, 
  updateUserAvatar, 
  getUserAvatar,
  getUserProfile,
  checkUsernameUnique as checkUsernameUniqueApi,
  updateUsername as updateUsernameApi,
  createUserProfile 
} from './lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from './constants/Colors';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from './i18n/i18n.config';
import { EventRegister } from 'react-native-event-listeners';

// Contexte fictif pour le thème (à implémenter complètement plus tard)
const ThemeContext = React.createContext({
  isDarkMode: true,
  toggleTheme: () => {}
});

const useTheme = () => useContext(ThemeContext);

// Configuration statique pour masquer l'en-tête d'Expo Router
export const unstable_settings = {
  initialRouteName: 'settings',
};

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  
  // État pour le mode sombre (simulé en attendant l'implémentation complète)
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // État pour afficher le modal de sélection de langue
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  // Langue courante
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // À implémenter: sauvegarder la préférence dans AsyncStorage
    // et mettre à jour le thème global de l'application
  };
  
  // Fonction pour changer la langue de l'application
  const handleChangeLanguage = async (language: string) => {
    const success = await changeLanguage(language);
    if (success) {
      setCurrentLanguage(language);
      setShowLanguageModal(false);
    }
  };

  useEffect(() => {
    // Initialiser les structures nécessaires
    const init = async () => {
      // Initialiser le stockage d'avatars
      await initAvatarBucket();
    };
    
    // Récupérer les informations de l'utilisateur connecté
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        
        // Récupérer le profil de l'utilisateur avec la fonction centralisée
        const { data: userData, error: userError } = await getUserProfile(data.user.id);
          
        if (userData && 'username' in userData) {
          setUsername(userData.username as string);
          setNewUsername(userData.username as string);
          
          // Si l'utilisateur a un avatar, l'afficher
          if ('avatar_url' in userData && userData.avatar_url) {
            setAvatar(userData.avatar_url as string);
            await AsyncStorage.setItem('@user_avatar', userData.avatar_url as string);
          }
        } else {
          // Utiliser l'email comme pseudo par défaut
          const defaultUsername = data.user.email?.split('@')[0] || 'User';
          setUsername(defaultUsername);
          setNewUsername(defaultUsername);
          
          // Si l'utilisateur n'a pas encore de profil, en créer un
          if (userError) {
            await createUserProfile(
              data.user.id, 
              defaultUsername, 
              data.user.email || ''
            );
          }
        }
        
        // Tentative de récupération de l'avatar depuis le stockage local si non trouvé
        if (!userData || !('avatar_url' in userData) || !userData.avatar_url) {
          const localAvatar = await AsyncStorage.getItem('@user_avatar');
          if (localAvatar) {
            setAvatar(localAvatar);
          }
        }
      }
    };
    
    init().then(() => getUser());
  }, []);

  const fetchAvatar = async (userId: string) => {
    try {
      // D'abord, essayer de récupérer depuis le stockage local
      const localAvatar = await AsyncStorage.getItem('@user_avatar');
      if (localAvatar) {
        setAvatar(localAvatar);
      }

      // Ensuite, récupérer depuis la base de données
      const { avatarUrl, error } = await getUserAvatar(userId);
      if (error) {
        console.error('Erreur lors de la récupération de l\'avatar:', error);
        return;
      }
      
      if (avatarUrl) {
        setAvatar(avatarUrl);
        await AsyncStorage.setItem('@user_avatar', avatarUrl);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'avatar:', error);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Supprimer l'avatar stocké localement lors de la déconnexion
      await AsyncStorage.removeItem('@user_avatar');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Erreur de déconnexion', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(t('settings.alerts.error'), t('settings.alerts.permissionDenied'));
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0].uri) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur lors du choix de l\'image:', error);
      Alert.alert(t('settings.alerts.error'), t('settings.alerts.error'));
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    
    try {
      setUploadingAvatar(true);
      
      // Stockage local de l'URI pour un accès immédiat
      await AsyncStorage.setItem('@user_avatar', uri);
      setAvatar(uri);
      
      // Convertir l'URI en base64
      let base64;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64
        });
      } catch (readError) {
        console.error('Erreur lors de la lecture du fichier:', readError);
        Alert.alert(
          t('settings.alerts.error'), 
          t('settings.alerts.readError')
        );
        return;
      }
      
      // Mise à jour de l'avatar dans la base de données
      const { success, error } = await updateUserAvatar(user.id, base64);
      
      if (!success) {
        console.error('Erreur lors de la mise à jour de l\'avatar:', error);
        Alert.alert(
          t('settings.alerts.error'), 
          t('settings.alerts.saveError')
        );
        return;
      }
      
      // Succès
      Alert.alert(t('settings.alerts.success'), t('settings.alerts.avatarUpdated'));
    } catch (error: any) {
      console.error('Erreur lors de l\'upload de l\'avatar:', error);
      Alert.alert(t('settings.alerts.error'), error.message || t('settings.alerts.error'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleOpenUsernameModal = () => {
    setNewUsername(username);
    setUsernameError('');
    setShowUsernameModal(true);
  };

  const handleUsernameChange = (text: string) => {
    setNewUsername(text);
    setUsernameError('');
  };

  const checkUsernameUnique = async (usernameToCheck: string) => {
    if (!user) return false;
    
    // Vérifier que le pseudo n'est pas vide
    if (!usernameToCheck.trim()) {
      setUsernameError(t('settings.alerts.emptyUsername'));
      return false;
    }
    
    // Vérifier la longueur du pseudo
    if (usernameToCheck.length < 3) {
      setUsernameError(t('settings.alerts.usernameTooShort'));
      return false;
    }
    
    // Vérifier les caractères spéciaux
    if (!/^[a-zA-Z0-9_]+$/.test(usernameToCheck)) {
      setUsernameError(t('settings.alerts.usernameInvalidChars'));
      return false;
    }
    
    try {
      setCheckingUsername(true);
      
      // Vérifier si le pseudo est déjà utilisé par un autre utilisateur avec la fonction centralisée
      const { isUnique, error } = await checkUsernameUniqueApi(user.id, usernameToCheck);
      
      if (error) {
        setUsernameError(t('settings.alerts.error'));
        return false;
      }
      
      if (!isUnique) {
        setUsernameError(t('settings.alerts.usernameAlreadyTaken'));
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification du pseudo:', error);
      setUsernameError(t('settings.alerts.error'));
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const saveUsername = async () => {
    if (!user) return;
    
    try {
      setCheckingUsername(true);
      
      // Vérifier si le pseudo est unique
      const isUnique = await checkUsernameUnique(newUsername);
      if (!isUnique) {
        return;
      }
      
      // Mettre à jour le pseudo avec la fonction centralisée
      const { success, error } = await updateUsernameApi(user.id, newUsername);
      
      if (!success) {
        console.error('Erreur lors de la mise à jour du pseudo:', error);
        setUsernameError(t('settings.alerts.error'));
        return;
      }
      
      // Mettre à jour l'état local
      setUsername(newUsername);
      setShowUsernameModal(false);
      
      // Indiquer que le username a été modifié pour permettre aux autres écrans de se rafraîchir
      AsyncStorage.setItem('@username_updated', 'true');
      
      Alert.alert(t('settings.alerts.success'), t('settings.alerts.usernameUpdated'));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du pseudo:', error);
      setUsernameError(t('settings.alerts.error'));
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.alerts.confirmDeleteAccount'),
      [
        { text: t('settings.alerts.cancel'), style: 'cancel' },
        { 
          text: t('settings.deleteAccount'), 
          style: 'destructive', 
          onPress: () => Alert.alert(t('settings.alerts.comingSoon'))
        }
      ]
    );
  };

  const handlePremium = () => {
    Alert.alert(t('settings.subscription'), t('settings.alerts.comingSoon'));
  };

  const handlePermissions = () => {
    Alert.alert(t('settings.permissions'), t('settings.alerts.comingSoon'));
  };

  const handleChangePassword = () => {
    Alert.alert(t('settings.password'), t('settings.alerts.comingSoon'));
  };
  
  const handleOpenTerms = () => {
    Alert.alert(t('settings.termsAndConditions'), t('settings.alerts.comingSoon'));
    // Lorsque le lien sera disponible:
    // Linking.openURL('https://votre-site.com/terms');
  };
  
  const handleOpenPrivacy = () => {
    Alert.alert(t('settings.privacyPolicy'), t('settings.alerts.comingSoon'));
    // Lorsque le lien sera disponible:
    // Linking.openURL('https://votre-site.com/privacy');
  };

  // Ajout du modal de sélection de langue
  const LanguageModal = () => (
    <Modal
      visible={showLanguageModal}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('settings.chooseLanguage')}</Text>
          
          <TouchableOpacity 
            style={[
              styles.languageOption, 
              currentLanguage === 'fr' && styles.languageOptionSelected
            ]}
            onPress={() => handleChangeLanguage('fr')}
          >
            <Text 
              style={[
                styles.languageOptionText, 
                currentLanguage === 'fr' && styles.languageOptionTextSelected
              ]}
            >
              {t('settings.french')}
            </Text>
            {currentLanguage === 'fr' && (
              <Ionicons name="checkmark" size={20} color={Colors.secondary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.languageOption, 
              currentLanguage === 'en' && styles.languageOptionSelected
            ]}
            onPress={() => handleChangeLanguage('en')}
          >
            <Text 
              style={[
                styles.languageOptionText, 
                currentLanguage === 'en' && styles.languageOptionTextSelected
              ]}
            >
              {t('settings.english')}
            </Text>
            {currentLanguage === 'en' && (
              <Ionicons name="checkmark" size={20} color={Colors.secondary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modalButton}
            onPress={() => setShowLanguageModal(false)}
          >
            <Text style={styles.modalButtonText}>{t('settings.alerts.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {/* Configuration de la Stack pour masquer l'en-tête natif */}
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* En-tête personnalisé avec bouton de retour */}
        <View style={styles.customHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
          <View style={{width: 24}} /> {/* Pour équilibrer l'en-tête */}
        </View>

        <ScrollView style={styles.container}>
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleAvatarChange}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <View style={styles.avatarImage}>
                  <ActivityIndicator color={Colors.secondary} size="large" />
                </View>
              ) : (
                <>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {username ? username[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.editIconContainer}>
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                  </View>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.userName}>{username || user?.email || 'Utilisateur'}</Text>
            <TouchableOpacity onPress={handleOpenUsernameModal}>
              <Text style={styles.changeUsername}>{t('settings.modifyUsername')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={handlePremium}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons name="cash-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.subscription')}</Text>
                <Text style={styles.itemSubtitle}>{t('settings.free')}</Text>
              </View>
              <TouchableOpacity onPress={handlePremium}>
                <Text style={styles.upgradeButton}>{t('settings.upgradeToPremium')}</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={toggleTheme}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons 
                  name={isDarkMode ? "moon-outline" : "sunny-outline"} 
                  size={24} 
                  color={Colors.secondary} 
                />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.customization')}</Text>
                <Text style={styles.itemSubtitle}>
                  {isDarkMode ? t('settings.darkTheme') : t('settings.lightTheme')}
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{false: '#767577', true: Colors.secondary}}
                thumbColor={isDarkMode ? '#f4f3f4' : '#f4f3f4'}
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={() => setShowLanguageModal(true)}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons name="language-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.language')}</Text>
                <Text style={styles.itemSubtitle}>
                  {currentLanguage === 'fr' ? t('settings.french') : t('settings.english')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={handlePermissions}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons name="lock-closed-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.permissions')}</Text>
                <Text style={styles.itemSubtitle}>{t('settings.manageAccess')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={handleChangePassword}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons name="key-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.password')}</Text>
                <Text style={styles.itemSubtitle}>{t('settings.modify')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionHeaderText}>{t('settings.about')}</Text>
            
            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={handleOpenTerms}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons name="document-text-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.termsAndConditions')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sectionItem}
              onPress={handleOpenPrivacy}
            >
              <View style={styles.itemIconContainer}>
                <Ionicons name="shield-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t('settings.privacyPolicy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.dangerButton}
              onPress={handleLogout}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.dangerButtonText}>{t('settings.logout')}</Text>
              )}
            </TouchableOpacity>

            {/* Bouton de suppression de compte commenté
            <TouchableOpacity 
              style={[styles.dangerButton, styles.deleteButton]}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.dangerButtonText}>Supprimer le compte</Text>
            </TouchableOpacity>
            */}
          </View>

          <View style={styles.footer}>
            <Text style={styles.version}>{t('settings.version')} 1.0.0</Text>
          </View>
          
          {/* Espace en bas pour éviter que le contenu soit caché par la navigation */}
          <View style={{ height: 40 }} />

        </ScrollView>

        {/* Modal pour modifier le pseudo */}
        <Modal
          visible={showUsernameModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('settings.changeUsernameModal.title')}</Text>
              
              <TextInput
                style={styles.usernameInput}
                value={newUsername}
                onChangeText={handleUsernameChange}
                placeholder={t('settings.changeUsernameModal.placeholder')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : null}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setShowUsernameModal(false)}
                >
                  <Text style={styles.modalButtonText}>{t('settings.changeUsernameModal.cancel')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={saveUsername}
                  disabled={checkingUsername}
                >
                  {checkingUsername ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>{t('settings.changeUsernameModal.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Modal pour changer la langue */}
        <LanguageModal />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40 : 10,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.secondary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  changeUsername: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
    marginLeft: 8,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  itemSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  upgradeButton: {
    color: Colors.secondary,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  version: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  usernameInput: {
    backgroundColor: Colors.background,
    width: '100%',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: Colors.text.primary,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  modalButtonPrimary: {
    backgroundColor: Colors.secondary,
  },
  modalButtonText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
    backgroundColor: Colors.background,
  },
  languageOptionSelected: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  languageOptionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  languageOptionTextSelected: {
    color: Colors.secondary,
    fontWeight: 'bold',
  },
}); 