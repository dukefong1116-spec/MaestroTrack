import { useEffect, useState } from 'react'
import { Bell, Clock, MessageSquare, CalendarDays, Inbox, Lightbulb, Trophy, Flame, MoonStar, Users, BarChart3, BellRing } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePrefs } from '@/hooks/usePrefs'
import { Panel, Block, Legend, ToggleRow, SettingsScreen } from '@/components/ui/Panel'
import SoundSetting from '@/components/settings/SoundSetting'
import Button from '@/components/ui/Button'
import { enableNotifications, notifyPermission, type Permission } from '@/lib/notify/push'
import { isNativeApp } from '@/lib/native'
import { haptic } from '@/lib/haptics'
import type { NotifyKind } from '@/types'

/**
 * What reaches you, and when.
 *
 * Each switch covers the same thing on the bell and as a notification:
 * the reminders the phone schedules itself (lib/notify/plan), and the
 * pushes the server sends about other people (api/push). Quiet hours and
 * the daily cap are fixed, and said so plainly.
 */
export default function NotificationsPage() {
  const { profile } = useAuth()
  const { prefs, set } = usePrefs()
  const isTeacher = profile?.role === 'teacher'
  const back = isTeacher ? '/teacher/settings' : '/student/settings'

  const toggle = (k: NotifyKind) => (next: boolean) => void set({ notify: { [k]: next } })

  // Whether this device can show them at all.
  const [permission, setPermission] = useState<Permission | null>(null)
  useEffect(() => { void notifyPermission().then(setPermission) }, [])
  async function turnOn() {
    const p = await enableNotifications()
    setPermission(p)
    if (p === 'granted') haptic('success')
  }

  return (
    <SettingsScreen title="Notifications" back={back}>
      <Panel>
        <Block first>
          <Legend title="On this device" />
          {permission === 'granted' && (
            <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--clay-ink)' }}>
              <BellRing size={17} style={{ color: 'var(--clay-success-fg)' }} /> Notifications are on.
            </p>
          )}
          {permission === 'prompt' && (
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-sm" style={{ color: 'var(--clay-dim)' }}>
                {isTeacher ? 'Hear about hand-ins, messages and lessons, even with the app closed.' : 'Reminders that keep your streak alive, and news from your teacher, even with the app closed.'}
              </p>
              <Button size="sm" className="shrink-0" onClick={() => void turnOn()}>Turn on</Button>
            </div>
          )}
          {permission === 'denied' && (
            <p className="text-sm" style={{ color: 'var(--clay-dim)' }}>
              {isNativeApp ? 'Turned off for Femata. Switch them on in the iPhone’s Settings › Femata › Notifications.' : 'Blocked in this browser. Allow them in the site settings (the icon beside the address).'}
            </p>
          )}
          {permission === 'unsupported' && (
            <p className="text-sm" style={{ color: 'var(--clay-dim)' }}>
              This browser can’t show notifications. On an iPhone, add Femata to your Home Screen (or get the app), and turn them on there.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--clay-faint)' }}>
            At most 3 a day (messages aside). Between 9 pm and 8 am they arrive quietly, without a sound.
          </p>
        </Block>

        <Block>
          <Legend title="What to hear about" hint="The same switches cover the bell in the app." />
        </Block>

        {isTeacher ? (
          <>
            <ToggleRow icon={<Inbox size={19} />} label="Hand-ins" hint="When a student submits work" checked={prefs.notify.submissions} onChange={toggle('submissions')} />
            <ToggleRow icon={<Users size={19} />} label="Studio" hint="Messages from students, and students asking to join" checked={prefs.notify.studio} onChange={toggle('studio')} />
            <ToggleRow icon={<CalendarDays size={19} />} label="Lessons" hint="15 minutes before each, and a nudge to leave a note after" checked={prefs.notify.lessons} onChange={toggle('lessons')} />
            <ToggleRow icon={<BarChart3 size={19} />} label="Weekly digest" hint="Students gone quiet (Monday) and the week in review (Sunday)" checked={prefs.notify.digest} onChange={toggle('digest')} />
          </>
        ) : (
          <>
            <ToggleRow icon={<Flame size={19} />} label="Practice reminders" hint="Your daily reminder, an evening nudge, freezes, pieces and performances" checked={prefs.notify.streak} onChange={toggle('streak')} />
            <ToggleRow icon={<MoonStar size={19} />} label="Last-chance streak alert" hint="Two hours before midnight, when nothing else can save your streak — even in quiet hours" checked={prefs.notify.lateStreak} onChange={toggle('lateStreak')} />
            <ToggleRow icon={<Bell size={19} />} label="New assignments" hint="When your teacher sets something or adds a piece" checked={prefs.notify.assignments} onChange={toggle('assignments')} />
            <ToggleRow icon={<MessageSquare size={19} />} label="Feedback" hint="When work comes back approved or for another go" checked={prefs.notify.feedback} onChange={toggle('feedback')} />
            <ToggleRow icon={<CalendarDays size={19} />} label="Lesson reminders" hint="The evening before, and an hour before" checked={prefs.notify.lessons} onChange={toggle('lessons')} />
            <ToggleRow icon={<Users size={19} />} label="Studio" hint="Messages from your teacher, and joining a studio" checked={prefs.notify.studio} onChange={toggle('studio')} />
            <ToggleRow icon={<Trophy size={19} />} label="League" hint="When someone passes you, and the last day" checked={prefs.notify.league} onChange={toggle('league')} />
            <ToggleRow icon={<Lightbulb size={19} />} label="Prompts on Today" hint="Nudges about your goal and your streak, in the app" checked={prefs.notify.nudges} onChange={toggle('nudges')} />

            <Block>
              <Legend
                title="Daily reminder"
                hint={prefs.reminderEnabled ? `Every day at ${prefs.reminderTime}, unless you’ve already practised.` : 'Around when you usually practise, unless you already have. Pick a set time instead?'}
              />
            </Block>
            <ToggleRow
              icon={<Clock size={19} />}
              label="At a set time"
              hint={prefs.reminderEnabled ? `At ${prefs.reminderTime}` : 'Learns from when you practise'}
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
