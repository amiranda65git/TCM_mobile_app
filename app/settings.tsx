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
  Linking
} from 'react-native';
import { router } from 'expo-router';
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

// Contexte fictif pour le thème (à implémenter complètement plus tard)
const ThemeContext = React.createContext({
  isDarkMode: true,
  toggleTheme: () => {}
});

const useTheme = () => useContext(ThemeContext);

export default function Settings() {
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
  
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // À implémenter: sauvegarder la préférence dans AsyncStorage
    // et mettre à jour le thème global de l'application
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
          
        if (userData && userData.username) {
          setUsername(userData.username);
          setNewUsername(userData.username);
          
          // Si l'utilisateur a un avatar, l'afficher
          if (userData.avatar_url) {
            setAvatar(userData.avatar_url);
            await AsyncStorage.setItem('@user_avatar', userData.avatar_url);
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
        if (!userData?.avatar_url) {
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
        Alert.alert('Permission refusée', 'Nous avons besoin de l\'accès à votre galerie pour changer votre avatar');
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
      Alert.alert('Erreur', 'Une erreur est survenue lors du choix de l\'image');
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
          'Erreur de lecture', 
          'Impossible de lire le fichier image. Réessayez avec une autre image.'
        );
        return;
      }
      
      // Mise à jour de l'avatar dans la base de données
      const { success, error } = await updateUserAvatar(user.id, base64);
      
      if (!success) {
        console.error('Erreur lors de la mise à jour de l\'avatar:', error);
        Alert.alert(
          'Erreur de sauvegarde', 
          'L\'image a été sauvegardée localement mais pas sur le serveur. Réessayez ultérieurement.'
        );
        return;
      }
      
      // Succès
      Alert.alert('Succès', 'Votre avatar a été mis à jour avec succès');
    } catch (error: any) {
      console.error('Erreur lors de l\'upload de l\'avatar:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de l\'upload de l\'avatar');
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
      setUsernameError('Le pseudo ne peut pas être vide');
      return false;
    }
    
    // Vérifier la longueur du pseudo
    if (usernameToCheck.length < 3) {
      setUsernameError('Le pseudo doit contenir au moins 3 caractères');
      return false;
    }
    
    // Vérifier les caractères spéciaux
    if (!/^[a-zA-Z0-9_]+$/.test(usernameToCheck)) {
      setUsernameError('Le pseudo ne peut contenir que des lettres, chiffres et _');
      return false;
    }
    
    try {
      setCheckingUsername(true);
      
      // Vérifier si le pseudo est déjà utilisé par un autre utilisateur avec la fonction centralisée
      const { isUnique, error } = await checkUsernameUniqueApi(user.id, usernameToCheck);
      
      if (error) {
        setUsernameError('Erreur lors de la vérification du pseudo');
        return false;
      }
      
      if (!isUnique) {
        setUsernameError('Ce pseudo est déjà utilisé');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification du pseudo:', error);
      setUsernameError('Erreur lors de la vérification du pseudo');
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
        setUsernameError('Erreur lors de la mise à jour du pseudo. Veuillez réessayer.');
        return;
      }
      
      // Mettre à jour l'état local
      setUsername(newUsername);
      setShowUsernameModal(false);
      
      // Indiquer que le username a été modifié pour permettre aux autres écrans de se rafraîchir
      AsyncStorage.setItem('@username_updated', 'true');
      
      Alert.alert('Succès', 'Votre pseudo a été mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du pseudo:', error);
      setUsernameError('Erreur lors de la sauvegarde du pseudo. Veuillez réessayer.');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive', 
          onPress: () => Alert.alert('Fonctionnalité', 'La suppression de compte sera implémentée prochainement')
        }
      ]
    );
  };

  const handlePremium = () => {
    Alert.alert('Premium', 'Fonctionnalité premium à venir prochainement');
  };

  const handlePermissions = () => {
    Alert.alert('Permissions', 'Gestion des permissions à venir prochainement');
  };

  const handleChangePassword = () => {
    Alert.alert('Changement de mot de passe', 'Cette fonctionnalité sera implémentée prochainement');
  };
  
  const handleOpenTerms = () => {
    Alert.alert('Conditions générales', 'Les conditions générales seront disponibles prochainement');
    // Lorsque le lien sera disponible:
    // Linking.openURL('https://votre-site.com/terms');
  };
  
  const handleOpenPrivacy = () => {
    Alert.alert('Politique de confidentialité', 'La politique de confidentialité sera disponible prochainement');
    // Lorsque le lien sera disponible:
    // Linking.openURL('https://votre-site.com/privacy');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
            <Text style={styles.changeUsername}>Modifier le pseudo</Text>
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
              <Text style={styles.itemTitle}>Abonnement</Text>
              <Text style={styles.itemSubtitle}>Gratuit</Text>
            </View>
            <TouchableOpacity onPress={handlePremium}>
              <Text style={styles.upgradeButton}>Passer Premium</Text>
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
              <Text style={styles.itemTitle}>Personnalisation</Text>
              <Text style={styles.itemSubtitle}>Thème {isDarkMode ? 'sombre' : 'clair'}</Text>
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
            onPress={handlePermissions}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="lock-closed-outline" size={24} color={Colors.secondary} />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Permissions</Text>
              <Text style={styles.itemSubtitle}>Gérer les accès</Text>
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
              <Text style={styles.itemTitle}>Mot de passe</Text>
              <Text style={styles.itemSubtitle}>Modifier</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionHeaderText}>À propos</Text>
          
          <TouchableOpacity 
            style={styles.sectionItem}
            onPress={handleOpenTerms}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="document-text-outline" size={24} color={Colors.secondary} />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Conditions générales</Text>
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
              <Text style={styles.itemTitle}>Avis de confidentialité</Text>
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
              <Text style={styles.dangerButtonText}>Se déconnecter</Text>
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
          <Text style={styles.version}>TCMarket v1.0.0</Text>
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
            <Text style={styles.modalTitle}>Modifier le pseudo</Text>
            
            <TextInput
              style={styles.usernameInput}
              value={newUsername}
              onChangeText={handleUsernameChange}
              placeholder="Entrez votre nouveau pseudo"
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
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={saveUsername}
                disabled={checkingUsername}
              >
                {checkingUsername ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? 25 : 0, // Espace pour la barre d'état
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
    marginTop: 40,  // Ajouter de l'espace supplémentaire en haut
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
}); 