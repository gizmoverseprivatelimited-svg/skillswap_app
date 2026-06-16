import { useMemo, useState, type ComponentType } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrainCircuit, Compass, Globe, Layers3, ShieldCheck, Sparkles, Users2 } from 'lucide-react-native';
import Colors from '../constants/colors';

interface FeatureGap {
  id: string;
  title: string;
  summary: string;
  impact: 'High' | 'Medium' | 'Low';
  priority: GapPriority;
  suggestions: string[];
  successSignal: string;
}

type GapPriority = 'Critical' | 'High' | 'Medium';
type PriorityFilter = GapPriority | 'All';

interface FeatureGroup {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  color: string;
  features: FeatureGap[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'onboarding',
    title: 'Adaptive Onboarding & Skill Graph',
    description: 'Ask smarter questions, visualize goals, and adapt the journey from day one.',
    icon: Sparkles,
    color: '#FDE68A',
    features: [
      {
        id: 'conversational-onboarding',
        title: 'Conversational coach onboarding',
        summary: 'Guided chat-based intake that captures motivations, learning style, and availability in under two minutes.',
        impact: 'High',
        priority: 'Critical',
        suggestions: [
          'Use an AI-led chat to capture skill goals, schedules, and preferred swap cadence.',
          'Visualize the user’s skill graph and highlight recommended next actions immediately after sign-up.',
        ],
        successSignal: 'Onboarding completion rate, time-to-first-swap',
      },
      {
        id: 'goal-tracking',
        title: 'Goal & milestone tracking',
        summary: 'Let members set learning goals, receive nudges, and celebrate streaks with confetti moments.',
        impact: 'High',
        priority: 'High',
        suggestions: [
          'Create a progress tracker with milestones for each swap or resource consumed.',
          'Add weekly recaps and motivational streak badges delivered via push/email.',
        ],
        successSignal: 'Weekly active learners, swap-to-goal conversion',
      },
    ],
  },
  {
    id: 'ai-matching',
    title: 'AI Matching & Copilot Experiences',
    description: 'Transform the marketplace with proactive recommendations and real-time copilots.',
    icon: BrainCircuit,
    color: '#C4B5FD',
    features: [
      {
        id: 'ai-concierge',
        title: 'AI skill concierge',
        summary: 'Give every member a dedicated agent that suggests swaps, resources, and intros based on intent.',
        impact: 'High',
        priority: 'Critical',
        suggestions: [
          'Expose a chat-first concierge that can book swaps, surface experts, and clip key resource moments.',
          'Use the agent to summarize swap outcomes and propose next steps automatically.',
        ],
        successSignal: 'Concierge engagement rate, swap bookings triggered by AI',
      },
      {
        id: 'live-copilot',
        title: 'Live session copilots',
        summary: 'Real-time AI notes, transcription, and follow-up tasks during swaps and workshops.',
        impact: 'High',
        priority: 'High',
        suggestions: [
          'Offer automatic transcription with highlights, action items, and resources to review post-session.',
          'Enable AI to suggest future pairings or advanced topics as the session unfolds.',
        ],
        successSignal: 'Session satisfaction, follow-up booking rate',
      },
    ],
  },
  {
    id: 'community',
    title: 'Community Signals & Safe Collaboration',
    description: 'Build trust with social signals, safeguards, and verified identities.',
    icon: ShieldCheck,
    color: '#FCA5A5',
    features: [
      {
        id: 'verified-profiles',
        title: 'Verified identities & skill badges',
        summary: 'Introduce multi-step verification, credential uploads, and peer-endorsed skill badges.',
        impact: 'High',
        priority: 'Critical',
        suggestions: [
          'Allow members to verify via LinkedIn, GitHub, or portfolio links and display confidence badges.',
          'Introduce badge seasons so experts can maintain credibility with fresh endorsements.',
        ],
        successSignal: 'Verified profile ratio, trust score growth',
      },
      {
        id: 'safety-toolkit',
        title: 'Safety toolkit & transparency center',
        summary: 'Provide code-of-conduct education, session recording controls, and simple reporting flows.',
        impact: 'Medium',
        priority: 'High',
        suggestions: [
          'Add an in-session safety button with quick report, block, and reschedule options.',
          'Publish a transparent trust dashboard with moderation stats updated monthly.',
        ],
        successSignal: 'Safety incidents per 1k swaps, average report resolution time',
      },
    ],
  },
  {
    id: 'engagement',
    title: 'Engagement Flywheel & Social Proof',
    description: 'Keep momentum with rituals, social loops, and community progression.',
    icon: Users2,
    color: '#86EFAC',
    features: [
      {
        id: 'micro-rituals',
        title: 'Weekly rituals & spotlight moments',
        summary: 'Feature swap retros, live jam sessions, and rotating community prompts to spark activity.',
        impact: 'High',
        priority: 'High',
        suggestions: [
          'Create a highlights reel fed by member-generated clips or quotes after each session.',
          'Host themed swap weeks with limited-time badges and leaderboards.',
        ],
        successSignal: 'Repeat swap rate, ritual participation',
      },
      {
        id: 'social-proof',
        title: 'Dynamic social proof',
        summary: 'Capture testimonials, before/after snapshots, and trending skill heatmaps.',
        impact: 'Medium',
        priority: 'Medium',
        suggestions: [
          'Display real-time feed of successful swaps and endorsements on the home tab.',
          'Enable shareable success cards optimized for social networks.',
        ],
        successSignal: 'Referral sign-ups, testimonial submissions',
      },
    ],
  },
  {
    id: 'monetization',
    title: 'Premium Monetization & Marketplace Ops',
    description: 'Unlock revenue with premium cohorts, credits, and curated experiences.',
    icon: Layers3,
    color: '#F9A8D4',
    features: [
      {
        id: 'credits',
        title: 'Skill credits economy',
        summary: 'Introduce earned and purchasable credits to balance value across swaps.',
        impact: 'High',
        priority: 'High',
        suggestions: [
          'Reward teaching and resource uploads with credits redeemable for premium mentors.',
          'Offer credit bundles and corporate sponsorships with tracked usage analytics.',
        ],
        successSignal: 'Credit circulation, paid conversion rate',
      },
      {
        id: 'curated-cohorts',
        title: 'Curated cohort experiences',
        summary: 'Time-bound micro-cohorts with facilitators, async briefs, and showcase finales.',
        impact: 'Medium',
        priority: 'Medium',
        suggestions: [
          'Layer structured curriculum, group messaging, and facilitator dashboards per cohort.',
          'Bundle sponsor perks such as tool credits or talent scouting opportunities.',
        ],
        successSignal: 'Cohort retention, sponsor renewals',
      },
    ],
  },
  {
    id: 'global-reach',
    title: 'Global Reach & Platform Accessibility',
    description: 'Scale beyond borders with localization, hybrid formats, and content automation.',
    icon: Globe,
    color: '#7DD3FC',
    features: [
      {
        id: 'localization',
        title: 'Localization & cultural playbooks',
        summary: 'Translate UI, automate captioning, and tailor swap etiquette by region.',
        impact: 'Medium',
        priority: 'High',
        suggestions: [
          'Add auto-translated resource summaries and localized push content.',
          'Create regional onboarding templates that honor cultural learning norms.',
        ],
        successSignal: 'International MAU growth, localized session volume',
      },
      {
        id: 'hybrid-events',
        title: 'Hybrid event infrastructure',
        summary: 'Support IRL meetups with RSVP flows, venue logistics, and replay archives.',
        impact: 'Medium',
        priority: 'Medium',
        suggestions: [
          'Offer host toolkits with agendas, checklists, and live polls.',
          'Sync attendance with app profiles to boost in-person credibility.',
        ],
        successSignal: 'Hybrid event attendance, host retention',
      },
    ],
  },
  {
    id: 'data-ops',
    title: 'Insights, Analytics & Growth Infrastructure',
    description: 'Measure the journey, test experiments, and surface live health metrics.',
    icon: Compass,
    color: '#FBCFE8',
    features: [
      {
        id: 'north-star-dashboard',
        title: 'North star metric cockpit',
        summary: 'Unify activation, swap health, and retention cohorts in one real-time dashboard.',
        impact: 'High',
        priority: 'Critical',
        suggestions: [
          'Ship a growth console showing funnel drop-offs, swap velocity, and AI concierge attribution.',
          'Automate alerts when key metrics slip week-over-week.',
        ],
        successSignal: 'Experiment velocity, retention lift per iteration',
      },
      {
        id: 'experimentation',
        title: 'Self-serve experimentation platform',
        summary: 'Allow PMs to launch feature flags, A/B tests, and multi-armed bandits without code changes.',
        impact: 'High',
        priority: 'High',
        suggestions: [
          'Layer feature flags with user targeting for cohorts such as new mentors or verified experts.',
          'Integrate outcome tracking that pushes learnings into weekly growth standups.',
        ],
        successSignal: 'Experiments shipped per quarter, stat-sig wins',
      },
    ],
  },
];

export default function FeatureAuditScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPriority, setSelectedPriority] = useState<PriorityFilter>('All');

  const metrics = useMemo(() => {
    const allFeatures = FEATURE_GROUPS.flatMap((group) => group.features);
    const critical = allFeatures.filter((feature) => feature.priority === 'Critical').length;
    const high = allFeatures.filter((feature) => feature.priority === 'High').length;
    const medium = allFeatures.filter((feature) => feature.priority === 'Medium').length;
    return {
      total: allFeatures.length,
      critical,
      high,
      medium,
    };
  }, []);

  const filteredGroups = useMemo(() => {
    return FEATURE_GROUPS.map((group) => {
      const features = group.features.filter((feature) => {
        if (selectedPriority === 'All') {
          return true;
        }
        return feature.priority === selectedPriority;
      });
      return { ...group, features };
    }).filter((group) => group.features.length > 0);
  }, [selectedPriority]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 + insets.bottom }]}
      testID="feature-audit-screen"
    >
      <LinearGradient
        colors={['#111827', '#1F2937']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 32 }]}
      >
        <View style={styles.heroHeader}>
          <Text style={styles.heroEyebrow}>SkillSwap Roadmap Intel</Text>
          <Text style={styles.heroTitle}>Latest product opportunities</Text>
          <Text style={styles.heroSubtitle}>
            A heatmap of high-leverage features modern skill marketplaces expect in 2025.
          </Text>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.total}</Text>
            <Text style={styles.metricLabel}>Gaps Identified</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.critical}</Text>
            <Text style={styles.metricLabel}>Critical</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.high}</Text>
            <Text style={styles.metricLabel}>High Impact</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.medium}</Text>
            <Text style={styles.metricLabel}>Momentum</Text>
          </View>
        </View>
        <View style={styles.filterRow}>
          <PriorityChip
            label="All priorities"
            isActive={selectedPriority === 'All'}
            onPress={() => setSelectedPriority('All')}
            testID="priority-all"
          />
          <PriorityChip
            label="Critical"
            tone="#F87171"
            isActive={selectedPriority === 'Critical'}
            onPress={() => setSelectedPriority('Critical')}
            testID="priority-critical"
          />
          <PriorityChip
            label="High"
            tone="#FB923C"
            isActive={selectedPriority === 'High'}
            onPress={() => setSelectedPriority('High')}
            testID="priority-high"
          />
          <PriorityChip
            label="Medium"
            tone="#FACC15"
            isActive={selectedPriority === 'Medium'}
            onPress={() => setSelectedPriority('Medium')}
            testID="priority-medium"
          />
        </View>
      </LinearGradient>

      {filteredGroups.map((group) => {
        const Icon = group.icon;
        return (
          <View key={group.id} style={styles.groupCard} testID={`group-${group.id}`}>
            <View style={[styles.groupHeader, { borderLeftColor: group.color }] }>
              <View style={[styles.groupIconWrap, { backgroundColor: `${group.color}33` }] }>
                <Icon size={20} color={group.color} />
              </View>
              <View style={styles.groupTextBlock}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <Text style={styles.groupDescription}>{group.description}</Text>
              </View>
            </View>
            <View style={styles.featureList}>
              {group.features.map((feature) => (
                <View key={feature.id} style={styles.featureCard} testID={`feature-${feature.id}`}>
                  <View style={styles.featureHeader}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <View style={styles.featurePriorityRow}>
                      <View style={[styles.priorityPill, getPriorityStyle(feature.priority)]}>
                        <Text style={[styles.priorityText, getPriorityTextStyle(feature.priority)]}>{feature.priority}</Text>
                      </View>
                      <View style={styles.impactPill}>
                        <Text style={styles.impactText}>{feature.impact} impact</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.featureSummary}>{feature.summary}</Text>
                  <View style={styles.suggestionList}>
                    {feature.suggestions.map((item, index) => (
                      <View key={`${feature.id}-suggestion-${index}`} style={styles.suggestionRow}>
                        <View style={styles.suggestionDot} />
                        <Text style={styles.suggestionText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.signalRow}>
                    <Text style={styles.signalLabel}>Success signal</Text>
                    <Text style={styles.signalValue}>{feature.successSignal}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

interface PriorityChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  tone?: string;
  testID: string;
}

function PriorityChip({ label, isActive, onPress, tone = '#38BDF8', testID }: PriorityChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.priorityChip, isActive && { backgroundColor: tone }]}
      testID={testID}
    >
      <Text style={[styles.priorityChipText, isActive && { color: '#0B1120' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getPriorityStyle(priority: GapPriority) {
  switch (priority) {
    case 'Critical':
      return { backgroundColor: '#F8717130', borderColor: '#F87171' };
    case 'High':
      return { backgroundColor: '#FB923C30', borderColor: '#FB923C' };
    case 'Medium':
    default:
      return { backgroundColor: '#FACC1530', borderColor: '#FACC15' };
  }
}

function getPriorityTextStyle(priority: GapPriority) {
  switch (priority) {
    case 'Critical':
      return { color: '#7F1D1D' };
    case 'High':
      return { color: '#7C2D12' };
    case 'Medium':
    default:
      return { color: '#78350F' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  hero: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 24,
  },
  heroHeader: {
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: 'rgba(191, 219, 254, 0.85)',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#F9FAFB',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(209, 213, 219, 0.8)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.6)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#F1F5F9',
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.75)',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  priorityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  priorityChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#E0F2FE',
  },
  groupCard: {
    marginTop: 28,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    gap: 18,
  },
  groupHeader: {
    flexDirection: 'row',
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.border,
    paddingLeft: 12,
    alignItems: 'center',
  },
  groupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTextBlock: {
    flex: 1,
    gap: 6,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  groupDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  featureList: {
    gap: 16,
  },
  featureCard: {
    borderRadius: 18,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    padding: 16,
    gap: 10,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  featurePriorityRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  impactPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  impactText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  featureSummary: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
  },
  suggestionList: {
    gap: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  suggestionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
    marginTop: 7,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  signalLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  signalValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});
