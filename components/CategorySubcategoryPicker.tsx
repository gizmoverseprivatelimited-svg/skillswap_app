import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import {
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Check,
  Sparkles,
  Palette,
  Code,
  Dumbbell,
  Globe,
  Music,
  Utensils,
  Briefcase,
  Camera,
  HeartPulse,
  Award,
  GraduationCap,
  Megaphone,
  DollarSign,
  PenTool,
  Trophy,
  Hammer,
  UserCheck,
  Layers,
  LucideIcon,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  CATEGORY_STRUCTURE,
  MAIN_CATEGORIES,
  getSubcategoriesForCategory,
} from '@/constants/categories';

interface CategorySubcategoryPickerProps {
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  onSelect: (category: string, subcategory: string) => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  error?: string;
  modalTitle?: string;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Arts & Crafts': Palette,
  Technology: Code,
  'Fitness & Wellness': Dumbbell,
  Languages: Globe,
  Music: Music,
  Cooking: Utensils,
  Business: Briefcase,
  'Photography & Video': Camera,
  'Health & Life': HeartPulse,
  'Professional Skills': Award,
  'Education & Teaching': GraduationCap,
  'Marketing & Sales': Megaphone,
  'Finance & Accounting': DollarSign,
  'Design & Creative': Palette,
  'Writing & Communication': PenTool,
  'Personal Development': Sparkles,
  'Sports & Games': Trophy,
  'DIY & Home Skills': Hammer,
  'Career & Jobs': UserCheck,
  'Other / Miscellaneous': Layers,
};

export default function CategorySubcategoryPicker({
  selectedCategory,
  selectedSubcategory,
  onSelect,
  onClear,
  label = 'Category & Subcategory',
  placeholder = 'Select Category & Subcategory',
  error,
  modalTitle = 'Select Category',
}: CategorySubcategoryPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle open modal
  const handleOpen = () => {
    if (selectedCategory && CATEGORY_STRUCTURE[selectedCategory]) {
      setActiveCategory(selectedCategory);
    } else {
      setActiveCategory(null);
    }
    setSearchQuery('');
    setModalVisible(true);
  };

  // Filtered categories and subcategories based on search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const results: { category: string; subcategory: string }[] = [];

    MAIN_CATEGORIES.forEach((cat) => {
      const subcats = getSubcategoriesForCategory(cat);
      subcats.forEach((subcat) => {
        if (
          subcat.toLowerCase().includes(query) ||
          cat.toLowerCase().includes(query)
        ) {
          results.push({ category: cat, subcategory: subcat });
        }
      });
    });

    return results;
  }, [searchQuery]);

  const handleSelectSubcategory = (cat: string, subcat: string) => {
    onSelect(cat, subcat);
    setModalVisible(false);
    setActiveCategory(null);
    setSearchQuery('');
  };

  const hasSelection = Boolean(selectedCategory && selectedSubcategory);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.triggerButton,
          hasSelection && styles.triggerButtonSelected,
          Boolean(error) && styles.triggerButtonError,
        ]}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        {hasSelection ? (
          <View style={styles.selectedContent}>
            <View style={styles.selectedIconWrap}>
              {(() => {
                const IconComponent = CATEGORY_ICONS[selectedCategory!] || Sparkles;
                return <IconComponent size={18} color={Colors.light.primary} />;
              })()}
            </View>
            <View style={styles.selectedTextWrap}>
              <Text style={styles.selectedCategoryText}>{selectedCategory}</Text>
              <Text style={styles.selectedSubcategoryText}>{selectedSubcategory}</Text>
            </View>
            {onClear ? (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.placeholderRow}>
            <Sparkles size={18} color={Colors.light.textTertiary} />
            <Text style={styles.placeholderText}>{placeholder}</Text>
            <ChevronRight size={18} color={Colors.light.textTertiary} />
          </View>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal Picker */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              {activeCategory ? (
                <TouchableOpacity
                  style={styles.headerBackBtn}
                  onPress={() => setActiveCategory(null)}
                >
                  <ChevronLeft size={22} color={Colors.light.primary} />
                  <Text style={styles.headerBackText}>Categories</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.modalTitle}>{modalTitle}</Text>
              )}

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Search size={18} color={Colors.light.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activeCategory
                    ? `Search in ${activeCategory}...`
                    : 'Search 240+ skills & categories...'
                }
                placeholderTextColor={Colors.light.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Body */}
            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* SEARCH RESULTS VIEW */}
              {searchResults !== null ? (
                <View style={styles.resultsSection}>
                  <Text style={styles.sectionHeading}>
                    {searchResults.length} Match
                    {searchResults.length === 1 ? '' : 'es'} Found
                  </Text>
                  {searchResults.length === 0 ? (
                    <View style={styles.emptySearch}>
                      <Text style={styles.emptySearchTitle}>No skills found</Text>
                      <Text style={styles.emptySearchSub}>
                        Try searching with a different keyword
                      </Text>
                    </View>
                  ) : (
                    searchResults.map((item, index) => {
                      const isSelected =
                        selectedCategory === item.category &&
                        selectedSubcategory === item.subcategory;
                      return (
                        <TouchableOpacity
                          key={`${item.category}-${item.subcategory}-${index}`}
                          style={[
                            styles.searchResultItem,
                            isSelected && styles.searchResultItemSelected,
                          ]}
                          onPress={() =>
                            handleSelectSubcategory(item.category, item.subcategory)
                          }
                          activeOpacity={0.7}
                        >
                          <View style={styles.searchResultLeft}>
                            <Text style={styles.searchResultSubcat}>
                              {item.subcategory}
                            </Text>
                            <Text style={styles.searchResultCat}>
                              in {item.category}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Check size={18} color={Colors.light.primary} />
                          ) : (
                            <ChevronRight
                              size={16}
                              color={Colors.light.textTertiary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ) : activeCategory ? (
                /* STEP 2: SUBCATEGORIES FOR ACTIVE CATEGORY */
                <View style={styles.subcatsSection}>
                  <View style={styles.activeCatHeader}>
                    <View style={styles.activeCatIconWrap}>
                      {(() => {
                        const IconComp = CATEGORY_ICONS[activeCategory] || Sparkles;
                        return <IconComp size={22} color={Colors.light.primary} />;
                      })()}
                    </View>
                    <View style={styles.activeCatTextWrap}>
                      <Text style={styles.activeCatTitle}>{activeCategory}</Text>
                      <Text style={styles.activeCatSub}>
                        Select a subcategory from below
                      </Text>
                    </View>
                  </View>

                  <View style={styles.subcatsGrid}>
                    {getSubcategoriesForCategory(activeCategory).map((subcat) => {
                      const isSelected =
                        selectedCategory === activeCategory &&
                        selectedSubcategory === subcat;
                      return (
                        <TouchableOpacity
                          key={subcat}
                          style={[
                            styles.subcatPill,
                            isSelected && styles.subcatPillSelected,
                          ]}
                          onPress={() =>
                            handleSelectSubcategory(activeCategory, subcat)
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.subcatPillText,
                              isSelected && styles.subcatPillTextSelected,
                            ]}
                          >
                            {subcat}
                          </Text>
                          {isSelected ? (
                            <Check size={16} color="#FFFFFF" />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* STEP 1: ALL 20 MAIN CATEGORIES */
                <View style={styles.categoriesSection}>
                  <Text style={styles.sectionHeading}>Choose a Category</Text>
                  <View style={styles.categoriesList}>
                    {MAIN_CATEGORIES.map((cat) => {
                      const IconComp = CATEGORY_ICONS[cat] || Sparkles;
                      const isCatSelected = selectedCategory === cat;
                      const subcount = getSubcategoriesForCategory(cat).length;

                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryCard,
                            isCatSelected && styles.categoryCardSelected,
                          ]}
                          onPress={() => setActiveCategory(cat)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.categoryIconWrap,
                              isCatSelected && styles.categoryIconWrapSelected,
                            ]}
                          >
                            <IconComp
                              size={20}
                              color={
                                isCatSelected
                                  ? '#FFFFFF'
                                  : Colors.light.primary
                              }
                            />
                          </View>
                          <View style={styles.categoryInfo}>
                            <Text
                              style={[
                                styles.categoryName,
                                isCatSelected && styles.categoryNameSelected,
                              ]}
                            >
                              {cat}
                            </Text>
                            <Text style={styles.categoryCount}>
                              {subcount} subcategories
                            </Text>
                          </View>
                          <ChevronRight
                            size={18}
                            color={
                              isCatSelected
                                ? Colors.light.primary
                                : Colors.light.textTertiary
                            }
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  triggerButton: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  triggerButtonSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '08',
  },
  triggerButtonError: {
    borderColor: Colors.light.error,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  placeholderText: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.textTertiary,
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTextWrap: {
    flex: 1,
  },
  selectedCategoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  selectedSubcategoryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 2,
  },
  clearBtn: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.error,
    marginTop: 4,
    marginLeft: 4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    minHeight: '65%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    marginHorizontal: 20,
    marginVertical: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    padding: 0,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Categories list
  categoriesSection: {
    marginTop: 4,
  },
  categoriesList: {
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 14,
  },
  categoryCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '0A',
  },
  categoryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapSelected: {
    backgroundColor: Colors.light.primary,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  categoryNameSelected: {
    color: Colors.light.primary,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },

  // Subcategories list
  subcatsSection: {
    marginTop: 4,
  },
  activeCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary + '30',
  },
  activeCatIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCatTextWrap: {
    flex: 1,
  },
  activeCatTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  activeCatSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  subcatsGrid: {
    gap: 10,
  },
  subcatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  subcatPillSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  subcatPillText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  subcatPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },

  // Search Results
  resultsSection: {
    marginTop: 4,
    gap: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  searchResultItemSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '0A',
  },
  searchResultLeft: {
    flex: 1,
  },
  searchResultSubcat: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  searchResultCat: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  emptySearch: {
    alignItems: 'center',
    padding: 30,
    gap: 8,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptySearchSub: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
});
