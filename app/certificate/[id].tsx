import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Share, Platform, Alert, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Download, Share2, Award, Sparkles, Calendar, Tag, User, ShieldCheck } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { useSafeTopInset } from '@/lib/safeArea';
import { useCurrentUser } from '@/providers/current-user';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import {
  buildSwapCertificates,
  buildClassCertificates,
  generateCertificateHTML,
  getCertificateLabel,
  formatDate,
  type CertificateData,
} from '@/lib/certificate';

export default function CertificateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTop = useSafeTopInset(isSmallScreen ? 14 : 24);
  const styles = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  const { currentUser, allUsers } = useCurrentUser();
  const { swaps } = useSkillSwaps();
  const { classes, enrollments } = useClasses();
  const [downloading, setDownloading] = useState(false);

  const allCertificates = useMemo<CertificateData[]>(() => {
    if (!currentUser) return [];
    const swapCerts = buildSwapCertificates(swaps, currentUser, allUsers);
    const classCerts = buildClassCertificates(classes, enrollments as any, currentUser, allUsers);
    return [...swapCerts, ...classCerts];
  }, [swaps, currentUser, allUsers, classes, enrollments]);

  const cert = useMemo(() => allCertificates.find(c => c.id === id), [allCertificates, id]);

  const handleDownload = useCallback(async () => {
    if (!cert) return;
    setDownloading(true);
    try {
      const html = generateCertificateHTML(cert);
      const filename = `leteski-certificate-${cert.certificateNumber}.html`;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        // Web: Create a hidden iframe to print ONLY the certificate HTML, bypassing the main React root
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const htmlContent = generateCertificateHTML(cert, true);
        
        if (iframe.contentWindow) {
          iframe.contentWindow.document.open();
          iframe.contentWindow.document.write(htmlContent);
          iframe.contentWindow.document.close();

          iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          };
        }
      } else {
        if (Platform.OS === 'android') {
          // Open the native Print / Save as PDF dialog without screen constraints
          await Print.printAsync({
            html: generateCertificateHTML(cert, true),
            orientation: Print.Orientation.landscape
          });
        } else {
          // iOS: Fallback to Share
          const { uri } = await Print.printToFileAsync({
            html: generateCertificateHTML(cert, true),
            base64: false
          });
          await Share.share({ url: uri, title: filename.replace('.html', '.pdf') });
        }
      }
    } catch (error) {
      console.error('[Certificate] Download failed:', error);
      Alert.alert('Error', 'Could not download certificate. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [cert]);

  const handleShare = useCallback(async () => {
    if (!cert) return;
    try {
      const message = `I earned a certificate on leteski!\n\n${getCertificateLabel(cert.type).title}\nSkill: ${cert.skillTitle}\nCompleted: ${formatDate(cert.completedAt)}\nCertificate: ${cert.certificateNumber}\n\nGet yours at leteski.com`;
      
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: 'leteski Certificate', text: message });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied', 'Certificate details copied to clipboard');
        }
      } else {
        // Mobile: Generate the PDF file silently and share it natively
        const { uri } = await Print.printToFileAsync({
          html: generateCertificateHTML(cert, true),
          base64: false
        });
        
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Certificate',
            UTI: 'com.adobe.pdf'
          });
        } else {
          await Share.share({ url: uri, message });
        }
      }
    } catch (error) {
      console.log('[Certificate] Share cancelled:', error);
    }
  }, [cert]);

  if (!cert) {
    return (
      <View style={styles.notFound}>
        <Award size={48} color={Colors.light.textTertiary} />
        <Text style={styles.notFoundText}>Certificate not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const label = getCertificateLabel(cert.type);
  const dateStr = formatDate(cert.completedAt);
  const roleText = cert.role === 'teacher' ? 'successfully taught' : 'successfully completed';
  const partnerLabel = cert.role === 'teacher' ? 'Students' : 'Instructor';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: safeTop }]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Certificate</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.headerBadge}>
            <Award size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.headerText}>{label.title}</Text>
          <Text style={styles.headerSub}>{label.subtitle}</Text>
        </LinearGradient>

        {/* Certificate Card */}
        <View style={styles.certWrap}>
          <LinearGradient
            colors={['#FFFFFF', '#FFFBF5', '#FFF7ED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.certCard}
          >
            {/* Decorative border frame */}
            <View style={styles.borderFrame} />
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            <View style={styles.certContent}>
              {/* Logo */}
              <View style={styles.certLogoRow}>
                <View style={styles.certLogoDot} />
                <Text style={styles.certLogoText}>leteski</Text>
                <View style={styles.certLogoDot} />
              </View>
              <Text style={styles.certSubtitleTop}>Skill Exchange Platform</Text>

              {/* Title */}
              <Text style={styles.certTitle}>{label.title}</Text>
              <Text style={styles.certSubtitle}>{label.subtitle}</Text>

              {/* Recipient */}
              <Text style={styles.certPresentedTo}>This certificate is proudly presented to</Text>
              <Text style={styles.certRecipientName}>{cert.recipientName}</Text>
              <View style={styles.nameUnderline} />

              {/* Body */}
              <Text style={styles.certBodyText}>
                For having <Text style={styles.certBold}>{roleText}</Text> the skill{' '}
                <Text style={styles.certSkillName}>{cert.skillTitle}</Text> ({cert.skillLevel} level) in the category of {cert.skillCategory}.
              </Text>
              <Text style={styles.certBodyText}>
                {partnerLabel}: <Text style={styles.certPartnerName}>{cert.partnerName}</Text>
              </Text>

              {/* Meta */}
              <View style={styles.certMetaRow}>
                <View style={styles.certMetaItem}>
                  <Calendar size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.certMetaLabel}>Date</Text>
                  <Text style={styles.certMetaValue}>{dateStr}</Text>
                </View>
                <View style={styles.certMetaItem}>
                  <Tag size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.certMetaLabel}>Level</Text>
                  <Text style={styles.certMetaValue}>{cert.skillLevel}</Text>
                </View>
                <View style={styles.certMetaItem}>
                  <ShieldCheck size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.certMetaLabel}>Verified</Text>
                  <Text style={styles.certMetaValue}>Yes</Text>
                </View>
              </View>

              {/* Signatures */}
              <View style={styles.certSignatures}>
                <View style={styles.certSigBlock}>
                  <View style={styles.certSigLine} />
                  <Text style={styles.certSigName}>leteski</Text>
                  <Text style={styles.certSigTitle}>Platform</Text>
                </View>
                <View style={styles.certSeal}>
                  <LinearGradient
                    colors={['#6366F1', '#4F46E5']}
                    style={styles.certSealGradient}
                  >
                    <Text style={styles.certSealText}>L</Text>
                  </LinearGradient>
                </View>
                <View style={styles.certSigBlock}>
                  <View style={styles.certSigLine} />
                  <Text style={styles.certSigName}>{cert.partnerName}</Text>
                  <Text style={styles.certSigTitle}>{cert.role === 'teacher' ? 'Verified' : 'Instructor'}</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.certFooter}>
                <Text style={styles.certNumber}>Certificate No: {cert.certificateNumber}</Text>
                <Text style={styles.certCompany}>Gizmoverse Private Limited</Text>
                <Text style={styles.certCompanySub}>leteski is a product of Gizmoverse Private Limited</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionGradient}
            >
              <Download size={20} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>{downloading ? 'Downloading...' : 'Download Certificate'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Share2 size={20} color={Colors.light.primary} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Sparkles size={16} color={Colors.light.accent} />
          <Text style={styles.infoNoteText}>
            This certificate verifies skill completion on the leteski platform. Download it as an HTML file you can open in any browser and print to PDF.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingTop: isSmallScreen ? 36 : 50,
    paddingBottom: isSmallScreen ? 20 : 32,
    paddingHorizontal: isSmallScreen ? 14 : 20,
    alignItems: 'center',
    borderBottomLeftRadius: isSmallScreen ? 18 : 28,
    borderBottomRightRadius: isSmallScreen ? 18 : 28,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: isSmallScreen ? 10 : 16,
  },
  backIcon: {
    width: isSmallScreen ? 34 : 40,
    height: isSmallScreen ? 34 : 40,
    borderRadius: isSmallScreen ? 17 : 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: isSmallScreen ? 34 : 40,
  },
  headerBadge: {
    width: isSmallScreen ? 44 : 60,
    height: isSmallScreen ? 44 : 60,
    borderRadius: isSmallScreen ? 22 : 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallScreen ? 8 : 12,
  },
  headerText: {
    fontSize: isSmallScreen ? 18 : 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSub: {
    fontSize: isSmallScreen ? 12 : 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500' as const,
    marginTop: 4,
  },
  certWrap: {
    paddingHorizontal: isSmallScreen ? 10 : 20,
    marginTop: isSmallScreen ? -10 : -16,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  certCard: {
    borderRadius: isSmallScreen ? 14 : 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  borderFrame: {
    position: 'absolute' as const,
    top: 12, left: 12, right: 12, bottom: 12,
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    zIndex: 1,
  },
  corner: {
    position: 'absolute' as const,
    width: 28, height: 28,
    borderWidth: 3,
    borderColor: '#F59E0B',
    zIndex: 2,
  },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  certContent: {
    padding: isSmallScreen ? 16 : 28,
    alignItems: 'center',
    zIndex: 3,
  },
  certLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  certLogoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  certLogoText: {
    fontSize: isSmallScreen ? 16 : 20,
    fontWeight: '800' as const,
    color: '#6366F1',
    letterSpacing: -0.5,
  },
  certSubtitleTop: {
    fontSize: isSmallScreen ? 9 : 10,
    color: '#64748B',
    fontWeight: '500' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    marginBottom: isSmallScreen ? 14 : 24,
  },
  certTitle: {
    fontSize: isSmallScreen ? 16 : 22,
    fontWeight: '800' as const,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 22 : 30,
    marginBottom: 4,
  },
  certSubtitle: {
    fontSize: isSmallScreen ? 9.5 : 11,
    color: '#6366F1',
    fontWeight: '600' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: isSmallScreen ? 14 : 24,
  },
  certPresentedTo: {
    fontSize: isSmallScreen ? 9.5 : 11,
    color: '#64748B',
    fontWeight: '500' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: isSmallScreen ? 4 : 8,
    textAlign: 'center',
  },
  certRecipientName: {
    fontSize: isSmallScreen ? 18 : 26,
    fontWeight: '700' as const,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: isSmallScreen ? 2 : 4,
  },
  nameUnderline: {
    width: 200,
    maxWidth: '60%',
    height: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: isSmallScreen ? 14 : 24,
  },
  certBodyText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#334155',
    lineHeight: isSmallScreen ? 18 : 22,
    textAlign: 'center',
    marginBottom: isSmallScreen ? 6 : 8,
    maxWidth: 520,
    width: '100%',
  },
  certBold: {
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  certSkillName: {
    fontWeight: '700' as const,
    color: '#6366F1',
  },
  certPartnerName: {
    fontWeight: '600' as const,
    color: '#0F172A',
  },
  certMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: isSmallScreen ? 12 : 24,
    marginVertical: isSmallScreen ? 14 : 24,
    flexWrap: 'wrap' as const,
  },
  certMetaItem: {
    alignItems: 'center',
    gap: 4,
  },
  certMetaLabel: {
    fontSize: isSmallScreen ? 8.5 : 9,
    color: '#94A3B8',
    fontWeight: '600' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  certMetaValue: {
    fontSize: isSmallScreen ? 11.5 : 13,
    color: '#0F172A',
    fontWeight: '700' as const,
  },
  certSignatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: isSmallScreen ? 12 : 20,
    paddingHorizontal: 10,
  },
  certSigBlock: {
    flex: 1,
    alignItems: 'center',
  },
  certSigLine: {
    width: '80%',
    borderTopWidth: 1.5,
    borderTopColor: '#334155',
    marginBottom: 6,
  },
  certSigName: {
    fontSize: isSmallScreen ? 10.5 : 12,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  certSigTitle: {
    fontSize: isSmallScreen ? 9 : 10,
    color: '#64748B',
  },
  certSeal: {
    width: isSmallScreen ? 38 : 50,
    height: isSmallScreen ? 38 : 50,
    borderRadius: isSmallScreen ? 19 : 25,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  certSealGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certSealText: {
    fontSize: isSmallScreen ? 16 : 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  certFooter: {
    alignItems: 'center',
    marginTop: isSmallScreen ? 14 : 20,
    paddingTop: isSmallScreen ? 10 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
  },
  certNumber: {
    fontSize: isSmallScreen ? 9.5 : 10,
    color: '#94A3B8',
    fontWeight: '600' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  certCompany: {
    fontSize: isSmallScreen ? 9.5 : 11,
    color: '#64748B',
    fontWeight: '600' as const,
  },
  certCompanySub: {
    fontSize: isSmallScreen ? 8 : 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 12,
    paddingHorizontal: isSmallScreen ? 14 : 20,
    marginTop: isSmallScreen ? 16 : 24,
  },
  downloadBtn: {
    flex: 1,
    borderRadius: isSmallScreen ? 12 : 16,
    overflow: 'hidden' as const,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isSmallScreen ? 6 : 8,
    paddingVertical: isSmallScreen ? 11 : 16,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: isSmallScreen ? 13.5 : 15,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isSmallScreen ? 6 : 8,
    paddingVertical: isSmallScreen ? 11 : 16,
    paddingHorizontal: isSmallScreen ? 16 : 24,
    borderRadius: isSmallScreen ? 12 : 16,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.primary + '30',
  },
  shareBtnText: {
    color: Colors.light.primary,
    fontWeight: '700' as const,
    fontSize: isSmallScreen ? 13.5 : 15,
  },
  infoNote: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: isSmallScreen ? 12 : 20,
    marginTop: isSmallScreen ? 14 : 20,
    backgroundColor: Colors.light.accent + '15',
    marginHorizontal: isSmallScreen ? 14 : 20,
    padding: isSmallScreen ? 10 : 14,
    borderRadius: isSmallScreen ? 10 : 14,
  },
  infoNoteText: {
    flex: 1,
    fontSize: isSmallScreen ? 11 : 12,
    color: Colors.light.textSecondary,
    lineHeight: isSmallScreen ? 15 : 18,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    gap: 12,
  },
  notFoundText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  backBtn: {
    marginTop: 8,
    paddingVertical: isSmallScreen ? 9 : 12,
    paddingHorizontal: isSmallScreen ? 18 : 24,
    backgroundColor: Colors.light.primary,
    borderRadius: isSmallScreen ? 10 : 14,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: isSmallScreen ? 13.5 : 15,
  },
});
