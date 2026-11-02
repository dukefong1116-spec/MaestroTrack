import { Bell, Clock, MessageSquare, CalendarDays, Inbox, Lightbulb } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePrefs } from '@/hooks/usePrefs'
import { Panel, Block, Legend, ToggleRow, SettingsScreen } from '@/components/ui/Panel'
import SoundSetting from '@/components/settings/SoundSetting'
import type { NotifyKind } from '@/types'

/**
 * What reaches you, and when.
 *
 * Every switch here turns off something the app genuinely produces —
 * `KINDS_BY_CATEGORY` in notifications.ts maps each one to the
 * NotificationKinds it covers, and useNotifications filters on it. There
 * is deliberately no "push" or "email" section: the project has no
 * backend, so nothing can be sent while the app is closed, and a switch
 * promising otherwise would be a lie in a settings screen.
 */
export default function NotificationsPage() {
  const { profile } = useAuth()
  const { prefs, set } = usePrefs()
  const isTeacher = profile?.role === 'teacher'
  const back = isTeacher ? '/teacher/settings' : '/student/settings'

  const toggle = (k: NotifyKind) => (next: boolean) => void set({ notify: { [k]: next } })

  return (
    <SettingsScreen title="Notifications" back={back}>
      <Panel>
        <Block first>
          <Legend title="In the app" hint="Which of these show up on the bell." />
        </Block>

        {isTeacher ? (
          <ToggleRow
            icon={<Inbox size={19} />}
            label="Hand-ins"
            hint="When a student submits work"
            checked={prefs.notify.submissions}
            onChange={toggle('submissions')}
          />
        ) : (
          <>
            <ToggleRow
              icon={<Bell size={19} />}
              label="New assignments"
              hint="When your teacher sets something"
              checked={prefs.notify.assignments}
              onChange={toggle('assignments')}
            />
            <ToggleRow
              icon={<MessageSquare size={19} />}
              label="Feedback"
              hint="When work comes back approved or for another go"
              checked={prefs.notify.feedback}
              onChange={toggle('feedback')}
            />
            <ToggleRow
              icon={<CalendarDays size={19} />}
              label="Lesson reminders"
              hint="The day before, and an hour before"
              checked={prefs.notify.lessons}
              onChange={toggle('lessons')}
            />
          </>
        )}

        {!isTeacher && (
        <>
          <ToggleRow
            icon={<Lightbulb size={19} />}
            label="Prompts on Today"
            hint="Nudges about your goal and your streak"
            checked={prefs.notify.nudges}
            onChange={toggle('nudges')}
          />
          <Block>
            <Legend
              title="Practice reminder"
              hint="A nudge at the time you pick. It can only appear while MaestroTrack is open in a tab — the app has no way to reach you when it is closed."
            />
          </Block>
          <ToggleRow
            icon={<Clock size={19} />}
            label="Daily reminder"
            hint={prefs.reminderEnabled ? `At ${prefs.reminderTime}` : 'Off'}
            checked={prefs.reminderEnabled}
            onChange={(next) => void set({ reminderEnabled: next })}
          />
          {prefs.reminderEnabled && (
            <Block>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>Time</span>
                <input
                  type="time"
                  value={prefs.reminderTime}
                  onChange={(e) => void set({ reminderTime: e.target.value })}
                  className="rounded-[var(--clay-r-sm)] px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
                />
              </label>
            </Block>
          )}
        </>
      )}

      {/* Stays per device, for the reason it already gives itself. */}
      <Block><SoundSetting bare /></Block>
      </Panel>
    </SettingsScreen>
  )
}
