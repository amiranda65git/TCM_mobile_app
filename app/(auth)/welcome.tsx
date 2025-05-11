import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  Image, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { router } from 'expo-router';
import Carousel from 'react-native-reanimated-carousel';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { Colors } from '../constants/Colors';

const { width, height } = Dimensions.get('window');

const welcomeSteps = [
  {
    id: 1,
    image: require('../../assets/images/welcome/welcome_step_1.png'),
    textKey: 'welcome.step1',
  },
  {
    id: 2,
    image: require('../../assets/images/welcome/welcome_step_2.png'),
    textKey: 'welcome.step2',
  },
  {
    id: 3,
    image: require('../../assets/images/welcome/welcome_step_3.png'),
    textKey: 'welcome.step3',
  },
  {
    id: 4,
    image: require('../../assets/images/welcome/welcome_step_4.png'),
    textKey: 'welcome.step4',
  },
];

interface WelcomeItem {
  id: number;
  image: any;
  textKey: string;
}

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef(null);

  const finishOnboarding = async () => {
    try {
      // Marquer l'onboarding comme terminé
      await AsyncStorage.setItem('@onboarding_completed', 'true');
      // Rediriger vers la page de connexion
      router.replace('/login');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'état d\'onboarding:', error);
      // En cas d'erreur, on continue quand même vers la page de connexion
      router.replace('/login');
    }
  };

  const handleNext = () => {
    if (activeIndex < welcomeSteps.length - 1) {
      if (carouselRef.current) {
        // @ts-ignore
        carouselRef.current.scrollTo({ index: activeIndex + 1, animated: true });
      }
    } else {
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  const renderItem = ({ item, index }: { item: WelcomeItem; index: number }) => {
    return (
      <TouchableWithoutFeedback onPress={handleNext}>
        <View style={styles.slide}>
          <Image source={item.image} style={styles.image} resizeMode="cover" />
          <View style={styles.textOverlay}>
            <Text style={[styles.text, { color: Colors.background }]}>{t(item.textKey)}</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.text.secondary }]}>{t('general.skip')}</Text>
        </TouchableOpacity>
      </View>
      
      <Carousel
        ref={carouselRef}
        loop={false}
        width={width}
        height={height}
        data={welcomeSteps}
        renderItem={renderItem}
        onSnapToItem={setActiveIndex}
      />
      
      <View style={styles.pagination}>
        {welcomeSteps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.paginationDot,
              { backgroundColor: i === activeIndex ? Colors.background : 'rgba(255, 255, 255, 0.5)' }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 40 : 40,
    right: 16,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  textOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 30,
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.background,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
}); 