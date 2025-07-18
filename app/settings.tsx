import React, { useState, useEffect } from 'react';
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
import { useTheme } from './lib/ThemeContext';
import { useThemeColors } from './lib/ThemeUtils';
import Constants from 'expo-constants';
import { useRevenueCat } from './lib/RevenueCatService';

// Configuration statique pour masquer l'en-tête d'Expo Router
export const unstable_settings = {
  initialRouteName: 'settings',
};

// Interface pour les propriétés du composant MenuItem
interface MenuItemProps {
  icon: string;
  iconColor?: string;
  text: string;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  isBorderless?: boolean;
}

// Fonction utilitaire pour obtenir la version de l'app de façon compatible Expo/EAS
function getAppVersion() {
  // Expo SDK 53+ : expoConfig
  if (Constants.expoConfig && Constants.expoConfig.version) return Constants.expoConfig.version;
  // Fallback
  return 'N/A';
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { isDarkMode, toggleTheme } = useTheme();
  const colors = useThemeColors();
  const { subscriptionStatus, loading: isLoadingRevenueCat } = useRevenueCat();
  
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  
  // États pour la modification du mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  // État pour afficher le modal de sélection de langue
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  // Langue courante
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  
  // États pour le signalement d'utilisateur
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedUsername, setReportedUsername] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportError, setReportError] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  
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
    router.push('/premium');
  };
  
  // Fonction pour obtenir le type d'abonnement
  const getSubscriptionType = () => {
    if (!subscriptionStatus.isActive || !subscriptionStatus.productId) return '';
    
    // Déterminer le type d'abonnement basé sur l'ID du produit
    if (subscriptionStatus.productId.includes('annual') || subscriptionStatus.productId.includes('yearly')) {
      return t('settings.subscription.annual', 'Annuel');
    } else if (subscriptionStatus.productId.includes('monthly') || subscriptionStatus.productId.includes('month')) {
      return t('settings.subscription.monthly', 'Mensuel');
    }
    return t('settings.subscription.premium', 'Premium');
  };

  const handlePermissions = () => {
    Alert.alert(t('settings.permissions'), t('settings.alerts.comingSoon'));
  };

  const handleChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  // Fonction pour valider et changer le mot de passe
  const handlePasswordSubmit = async () => {
    if (!currentPassword.trim()) {
      setPasswordError(t('settings.password.currentPasswordRequired', 'Le mot de passe actuel est requis'));
      return;
    }

    if (!newPassword.trim()) {
      setPasswordError(t('settings.password.newPasswordRequired', 'Le nouveau mot de passe est requis'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('settings.password.passwordTooShort', 'Le mot de passe doit contenir au moins 6 caractères'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.password.passwordsDoNotMatch', 'Les mots de passe ne correspondent pas'));
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t('settings.password.samePassword', 'Le nouveau mot de passe doit être différent de l\'actuel'));
      return;
    }

    setUpdatingPassword(true);
    setPasswordError('');

    try {
      // Vérifier d'abord le mot de passe actuel en essayant de se reconnecter
      if (user?.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        });

        if (signInError) {
          setPasswordError(t('settings.password.incorrectCurrentPassword', 'Le mot de passe actuel est incorrect'));
          return;
        }
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        console.error('Erreur lors de la mise à jour du mot de passe:', updateError);
        setPasswordError(t('settings.password.updateError', 'Erreur lors de la mise à jour du mot de passe'));
        return;
      }

      // Succès
      Alert.alert(
        t('settings.alerts.success'), 
        t('settings.password.updateSuccess', 'Mot de passe mis à jour avec succès')
      );
      setShowPasswordModal(false);

    } catch (error: any) {
      console.error('Erreur lors du changement de mot de passe:', error);
      setPasswordError(t('settings.password.unexpectedError', 'Une erreur inattendue s\'est produite'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://www.tcmarket.app/conditions-generales');
  };

  const handleOpenReportModal = () => {
    setReportedUsername('');
    setReportComment('');
    setReportError('');
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    // Validation du formulaire
    if (!reportedUsername.trim()) {
      setReportError('Le pseudonyme de l\'utilisateur à signaler est requis');
      return;
    }

    // Vérifier que l'utilisateur ne se signale pas lui-même
    if (reportedUsername.trim().toLowerCase() === username.toLowerCase()) {
      setReportError('Vous ne pouvez pas vous signaler vous-même');
      return;
    }

    // Vérifier la longueur du pseudonyme
    if (reportedUsername.length < 3) {
      setReportError('Le pseudonyme doit contenir au moins 3 caractères');
      return;
    }

    setSubmittingReport(true);
    setReportError('');

    try {
      // TODO: Implémenter l'envoi d'email à l'administrateur
      // Pour l'instant, on simule la soumission
      console.log('=== SIGNALEMENT D\'UTILISATEUR ===');
      console.log('Signalé par:', username, '(', user?.email, ')');
      console.log('Utilisateur signalé:', reportedUsername);
      console.log('Commentaire:', reportComment || 'Aucun commentaire');
      console.log('Date:', new Date().toISOString());
      console.log('================================');

      // Simuler un délai d'envoi
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        'Signalement envoyé',
        'Votre signalement a été transmis à l\'équipe de modération. Nous examinerons votre demande dans les plus brefs délais.',
        [{ text: 'OK', onPress: () => setShowReportModal(false) }]
      );

    } catch (error) {
      console.error('Erreur lors de l\'envoi du signalement:', error);
      setReportError('Une erreur s\'est produite lors de l\'envoi du signalement');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Définir les styles dynamiques en fonction du thème
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 10 : 10,
      paddingBottom: 10,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      flex: 1,
      textAlign: 'center',
    },
    backButton: {
      padding: 10,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      marginVertical: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text.secondary,
      marginVertical: 12,
      marginHorizontal: 20,
    },
    userInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: colors.surface,
    },
    userDetails: {
      marginLeft: 16,
      flex: 1,
    },
    username: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    email: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuItemText: {
      fontSize: 16,
      color: colors.text.primary,
      flex: 1,
      marginLeft: 12,
    },
    logoutText: {
      fontSize: 16,
      color: colors.error,
      flex: 1,
      marginLeft: 12,
    },
    deleteAccountText: {
      fontSize: 16,
      color: colors.error,
      flex: 1,
      marginLeft: 12,
    },
    iconContainer: {
      width: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    chevronContainer: {
      marginLeft: 'auto',
    },
    versionText: {
      textAlign: 'center',
      color: colors.text.secondary,
      fontSize: 12,
      marginVertical: 16,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      width: '80%',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 16,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      color: colors.text.primary,
      backgroundColor: colors.surface,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    button: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      marginHorizontal: 4,
      borderRadius: 8,
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    cancelButtonText: {
      color: colors.text.primary,
    },
    saveButtonText: {
      color: '#FFFFFF',
    },
    errorText: {
      color: colors.error,
      marginBottom: 16,
    },
    themeSwitch: {
      marginLeft: 'auto',
    },
    currentOption: {
      fontSize: 16,
      color: colors.text.secondary,
      marginLeft: 'auto',
      marginRight: 8,
    },
    languageOption: {
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    languageText: {
      fontSize: 16,
      color: colors.text.primary,
    },
    selectedLanguage: {
      color: colors.primary,
      fontWeight: 'bold',
    },
  });

  // Composant pour un élément de menu
  const MenuItem = ({ icon, iconColor, text, onPress = () => {}, rightComponent, isBorderless = false }: MenuItemProps) => (
    <TouchableOpacity 
      style={[
        dynamicStyles.menuItem, 
        isBorderless && { borderBottomWidth: 0 }
      ]} 
      onPress={onPress}
    >
      <View style={dynamicStyles.iconContainer}>
        <Ionicons name={icon as any} size={22} color={iconColor || colors.text.primary} />
      </View>
      
      <Text style={[
        dynamicStyles.menuItemText,
        text === t('settings.logout') && dynamicStyles.logoutText,
        text === t('settings.deleteAccount') && dynamicStyles.deleteAccountText,
      ]}>
        {text}
      </Text>
      
      {rightComponent ? (
        rightComponent
      ) : (
        <View style={dynamicStyles.chevronContainer}>
          <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
        </View>
      )}
    </TouchableOpacity>
  );

  // Modal pour la sélection de langue
  const LanguageModal = () => (
    <Modal
      visible={showLanguageModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowLanguageModal(false)}
    >
      <View style={dynamicStyles.modalContainer}>
        <View style={dynamicStyles.modalContent}>
          <Text style={dynamicStyles.modalTitle}>{t('settings.chooseLanguage')}</Text>
          
          <TouchableOpacity 
            style={dynamicStyles.languageOption} 
            onPress={() => handleChangeLanguage('fr')}
          >
            <Text style={[
              dynamicStyles.languageText, 
              currentLanguage === 'fr' && dynamicStyles.selectedLanguage
            ]}>
              {t('settings.french')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[dynamicStyles.languageOption, { borderBottomWidth: 0 }]} 
            onPress={() => handleChangeLanguage('en')}
          >
            <Text style={[
              dynamicStyles.languageText, 
              currentLanguage === 'en' && dynamicStyles.selectedLanguage
            ]}>
              {t('settings.english')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[dynamicStyles.button, dynamicStyles.cancelButton, { marginTop: 16 }]} 
            onPress={() => setShowLanguageModal(false)}
          >
            <Text style={[dynamicStyles.buttonText, dynamicStyles.cancelButtonText]}>
              {t('settings.changeUsernameModal.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Maintenant, passons au rendu de l'écran
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <View style={dynamicStyles.header}>
        <TouchableOpacity style={dynamicStyles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.title}>{t('settings.title')}</Text>
        <View style={{ width: 44 }} />
      </View>
      
      <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
        {/* Section Profil */}
        <View style={dynamicStyles.section}>
          <TouchableOpacity style={dynamicStyles.userInfoContainer} onPress={handleAvatarChange}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={dynamicStyles.avatar} />
            ) : (
              <View style={dynamicStyles.avatar}>
                <Ionicons name="person" size={40} color={colors.text.secondary} />
              </View>
            )}
            
            <View style={dynamicStyles.userDetails}>
              <Text style={dynamicStyles.username}>{username}</Text>
              <Text style={dynamicStyles.email}>{user?.email || ''}</Text>
            </View>
            
            {uploadingAvatar ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View>
                <Ionicons name="camera-outline" size={24} color={colors.text.secondary} />
              </View>
            )}
          </TouchableOpacity>
          
          <MenuItem 
            icon="pencil" 
            text={t('settings.modifyUsername')} 
            onPress={handleOpenUsernameModal}
          />
        </View>
        
        {/* Section Abonnement */}
        <Text style={dynamicStyles.sectionTitle}>{t('settings.subscription')}</Text>
        <View style={dynamicStyles.section}>
          <MenuItem 
            icon="diamond" 
            iconColor="#FFD700"
            text={subscriptionStatus.isActive ? t('settings.premium', 'Premium') : t('settings.free')} 
            rightComponent={
              <View style={dynamicStyles.badge}>
                <Text style={dynamicStyles.badgeText}>
                  {subscriptionStatus.isActive ? getSubscriptionType() : t('settings.free')}
                </Text>
              </View>
            }
            isBorderless={!subscriptionStatus.isActive}
          />
          
          <MenuItem 
            icon="rocket" 
            text={subscriptionStatus.isActive ? t('settings.manageSubscription', 'Gérer mon abonnement') : t('premium.whyPay', 'Pourquoi payer ?')} 
            onPress={handlePremium}
            isBorderless={subscriptionStatus.isActive}
          />
        </View>
        
        {/* Section Personnalisation */}
        <Text style={dynamicStyles.sectionTitle}>{t('settings.customization')}</Text>
        <View style={dynamicStyles.section}>
          <MenuItem 
            icon={isDarkMode ? "moon" : "sunny"} 
            text={isDarkMode ? t('settings.darkTheme') : t('settings.lightTheme')} 
            rightComponent={
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: Colors.primary }}
                thumbColor="#f4f3f4"
                ios_backgroundColor="#767577"
                style={dynamicStyles.themeSwitch}
              />
            }
          />
          
          <MenuItem 
            icon="language" 
            text={t('settings.language')} 
            rightComponent={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={dynamicStyles.currentOption}>
                  {currentLanguage === 'fr' ? t('settings.french') : t('settings.english')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </View>
            }
            onPress={() => setShowLanguageModal(true)}
          />
        </View>
        
        
        {/* Section Sécurité */}
        <Text style={dynamicStyles.sectionTitle}>{t('settings.password')}</Text>
        <View style={dynamicStyles.section}>
          <MenuItem 
            icon="lock-closed" 
            text={t('settings.modify')} 
            onPress={handleChangePassword}
          />
        </View>
        
        {/* Section À propos */}
        <Text style={dynamicStyles.sectionTitle}>{t('settings.about')}</Text>
        <View style={dynamicStyles.section}>
          <MenuItem 
            icon="document-text" 
            text={t('settings.termsAndConditions')} 
            onPress={handleOpenTerms}
            isBorderless
          />
        </View>

        {/* Section Modération */}
        <Text style={dynamicStyles.sectionTitle}>{t('settings.moderation', 'Modération')}</Text>
        <View style={dynamicStyles.section}>
          <MenuItem 
            icon="flag" 
            iconColor="#FF6B6B"
            text={t('settings.reportUser', 'Signaler un utilisateur')} 
            onPress={handleOpenReportModal}
          />
        </View>
        
        {/* Section Compte */}
        <Text style={dynamicStyles.sectionTitle}>{t('settings.account')}</Text>
        <View style={dynamicStyles.section}>
          <MenuItem 
            icon="log-out" 
            iconColor={colors.error}
            text={t('settings.logout')} 
            onPress={handleLogout}
          />
          
          <MenuItem 
            icon="trash" 
            iconColor={colors.error}
            text={t('settings.deleteAccount')} 
            onPress={handleDeleteAccount}
            isBorderless
          />
        </View>
        
        <Text style={dynamicStyles.versionText}>
          {t('settings.version')} {getAppVersion()}
        </Text>
      </ScrollView>
      
      {/* Modals */}
      <LanguageModal />
      
      {/* Modal de signalement d'utilisateur */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>{t('settings.reportUser', 'Signaler un utilisateur')}</Text>
            
            <Text style={[dynamicStyles.modalSubtitle, { color: colors.text.secondary, marginBottom: 16 }]}>
              {t('settings.reportUserDescription', 'Veuillez indiquer le pseudonyme de l\'utilisateur que vous souhaitez signaler.')}
            </Text>
            
            <TextInput
              style={dynamicStyles.input}
              value={reportedUsername}
              onChangeText={setReportedUsername}
              placeholder={t('settings.usernamePlaceholder', 'Pseudonyme de l\'utilisateur')}
              placeholderTextColor={colors.text.secondary}
              autoCapitalize="none"
            />
            
            <TextInput
              style={[dynamicStyles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reportComment}
              onChangeText={setReportComment}
              placeholder={t('settings.commentPlaceholder', 'Commentaire (optionnel)')}
              placeholderTextColor={colors.text.secondary}
              multiline
              numberOfLines={3}
            />
            
            {reportError ? (
              <Text style={dynamicStyles.errorText}>{reportError}</Text>
            ) : null}
            
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.button, dynamicStyles.cancelButton]}
                onPress={() => setShowReportModal(false)}
              >
                <Text style={[dynamicStyles.buttonText, dynamicStyles.cancelButtonText]}>
                  {t('general.cancel', 'Annuler')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.button, dynamicStyles.saveButton]}
                onPress={handleSubmitReport}
                disabled={submittingReport || !reportedUsername.trim()}
              >
                {submittingReport ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[dynamicStyles.buttonText, dynamicStyles.saveButtonText]}>
                    {t('settings.reportButton', 'Signaler')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modale de changement de mot de passe */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>
              {t('settings.password.changeTitle', 'Modifier le mot de passe')}
            </Text>
            
            <TextInput
              style={dynamicStyles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={t('settings.password.currentPassword', 'Mot de passe actuel')}
              placeholderTextColor={colors.text.secondary}
              secureTextEntry
              autoCapitalize="none"
            />
            
            <TextInput
              style={dynamicStyles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('settings.password.newPassword', 'Nouveau mot de passe')}
              placeholderTextColor={colors.text.secondary}
              secureTextEntry
              autoCapitalize="none"
            />
            
            <TextInput
              style={dynamicStyles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('settings.password.confirmPassword', 'Confirmer le nouveau mot de passe')}
              placeholderTextColor={colors.text.secondary}
              secureTextEntry
              autoCapitalize="none"
            />
            
            {passwordError ? (
              <Text style={dynamicStyles.errorText}>{passwordError}</Text>
            ) : null}
            
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.button, dynamicStyles.cancelButton]}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={[dynamicStyles.buttonText, dynamicStyles.cancelButtonText]}>
                  {t('settings.changeUsernameModal.cancel')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.button, dynamicStyles.saveButton]}
                onPress={handlePasswordSubmit}
                disabled={updatingPassword || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
              >
                {updatingPassword ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[dynamicStyles.buttonText, dynamicStyles.saveButtonText]}>
                    {t('settings.password.update', 'Modifier')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Modal
        visible={showUsernameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUsernameModal(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>{t('settings.changeUsernameModal.title')}</Text>
            
            <TextInput
              style={dynamicStyles.input}
              value={newUsername}
              onChangeText={handleUsernameChange}
              placeholder={t('settings.changeUsernameModal.placeholder')}
              placeholderTextColor={colors.text.secondary}
              autoCapitalize="none"
            />
            
            {usernameError ? (
              <Text style={dynamicStyles.errorText}>{usernameError}</Text>
            ) : null}
            
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.button, dynamicStyles.cancelButton]}
                onPress={() => setShowUsernameModal(false)}
              >
                <Text style={[dynamicStyles.buttonText, dynamicStyles.cancelButtonText]}>
                  {t('settings.changeUsernameModal.cancel')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.button, dynamicStyles.saveButton]}
                onPress={saveUsername}
                disabled={checkingUsername || newUsername === username || !newUsername.trim()}
              >
                {checkingUsername ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[dynamicStyles.buttonText, dynamicStyles.saveButtonText]}>
                    {t('settings.changeUsernameModal.save')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 