import { useAuthStore } from '@/stores/authStore'
import { saveStreakRules } from '@/lib/firebase/teacher'
import { withChoice, localDay, type RuleChoice } from './plan'

/**
 * Saves a new daily minimum and lesson day. They start tomorrow — see
 * withChoice — and the profile in memory is updated once the write lands.
 */
export async function saveRuleChoice(choice: RuleChoice): Promise<void> {
  const profile = useAuthStore.getState().profile
  if (!profile) return
  const rules = withChoice(profile.streakRules, choice, localDay())
  await saveStreakRules(profile.uid, rules)
  const latest = useAuthStore.getState().profile
  if (latest) useAuthStore.getState().setProfile({ ...latest, streakRules: rules })
}
