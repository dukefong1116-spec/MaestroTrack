import WidgetKit
import SwiftUI
import ActivityKit
import AppIntents

// Femata's Home Screen and Lock Screen widgets, and the practice session's
// Live Activity (Lock Screen + Dynamic Island). The app writes the numbers
// (FemataShared / FemataSnapshot); everything here only reads them.

private let sky = Color(red: 0.239, green: 0.710, blue: 0.961)
private let skyDeep = Color(red: 0.122, green: 0.561, blue: 0.820)
private let flameOrange = Color(red: 0.949, green: 0.522, blue: 0.165)
private let ink = Color(red: 0.055, green: 0.086, blue: 0.149)

@main
struct FemataWidgetBundle: WidgetBundle {
    var body: some Widget {
        StreakWidget()
        TodayWidget()
        TeacherWidget()
        PracticeLiveActivity()
    }
}

// MARK: - Timeline

struct FemataEntry: TimelineEntry {
    let date: Date
    let snapshot: FemataSnapshot?
}

struct FemataProvider: TimelineProvider {
    func placeholder(in context: Context) -> FemataEntry { FemataEntry(date: Date(), snapshot: .sample) }

    func getSnapshot(in context: Context, completion: @escaping (FemataEntry) -> Void) {
        completion(FemataEntry(date: Date(), snapshot: FemataSnapshot.load()?.asOf(Date()) ?? .sample))
    }

    /// Now, and again just after midnight, when "today" starts over.
    func getTimeline(in context: Context, completion: @escaping (Timeline<FemataEntry>) -> Void) {
        let now = Date()
        let saved = FemataSnapshot.load()
        var entries = [FemataEntry(date: now, snapshot: saved?.asOf(now))]
        let cal = Calendar.current
        if let midnight = cal.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime) {
            entries.append(FemataEntry(date: midnight, snapshot: saved?.asOf(midnight)))
            // And at 7pm, when an unlit day starts to matter.
            if let evening = cal.date(bySettingHour: 19, minute: 0, second: 0, of: now), evening > now {
                entries.insert(FemataEntry(date: evening, snapshot: saved?.asOf(evening)), at: 1)
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

extension FemataSnapshot {
    static let sample = FemataSnapshot(role: "student", day: FemataSnapshot.dayString(), name: "Kai", streak: 12, todayLit: false, todayMinutes: 0, goalMinutes: 30, week: [true, true, true, true, true, true, false], todayIndex: 6, streakGoal: 14, nextLessonTitle: nil, nextLessonStart: nil, toReview: 0)

    var minutesLeft: Int { max(0, goalMinutes - todayMinutes) }
    /// Femata's face for the day so far.
    func mood(at date: Date) -> String {
        if todayLit { return todayMinutes >= goalMinutes && goalMinutes > 0 ? "FemataCelebrate" : "FemataProud" }
        let hour = Calendar.current.component(.hour, from: date)
        return hour >= 19 ? "FemataThinking" : "FemataSleepy"
    }
    var line: String {
        if todayLit { return todayMinutes >= goalMinutes ? "Goal done. See you tomorrow!" : "Today's lit!" }
        return streak > 0 ? "\(min(minutesLeft, 10) == 0 ? 10 : min(minutesLeft, 10)) min keeps it going" : "Start a streak today"
    }
}

// MARK: - Pieces

struct FlameNumber: View {
    let lit: Bool
    let number: Int
    var size: CGFloat = 26
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Image(lit ? "FlameLit" : "FlameDim").resizable().scaledToFit().frame(width: size * 0.8, height: size * 0.8).alignmentGuide(.firstTextBaseline) { d in d[.bottom] - 2 }
            Text("\(number)").font(.system(size: size, weight: .black, design: .rounded)).monospacedDigit()
        }
    }
}

struct GoalRing: View {
    let minutes: Int
    let goal: Int
    var dark = false
    var body: some View {
        let progress = goal > 0 ? min(1, Double(minutes) / Double(goal)) : 0
        ZStack {
            Circle().stroke(dark ? Color.white.opacity(0.15) : Color.black.opacity(0.07), lineWidth: 7)
            Circle().trim(from: 0, to: progress).stroke(sky, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
            VStack(spacing: 1) {
                Text("\(minutes)").font(.system(size: 19, weight: .black, design: .rounded)).monospacedDigit()
                Text("/ \(goal) min").font(.system(size: 9, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
            }
            .padding(10) // keeps the words inside the ring
        }
        .frame(width: 80, height: 80)
    }
}

struct WeekDots: View {
    let week: [Bool]
    let todayIndex: Int
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<7, id: \.self) { i in
                Circle()
                    .fill(i < week.count && week[i] ? flameOrange : Color.gray.opacity(0.22))
                    .frame(width: 13, height: 13)
                    .overlay(Circle().stroke(i == todayIndex ? sky : .clear, lineWidth: 2).padding(-2))
            }
        }
    }
}

struct OpenFemata: View {
    let text: String
    var body: some View {
        VStack(spacing: 6) {
            Image("FemataHappy").resizable().scaledToFit().frame(width: 60)
            Text(text).font(.system(size: 12, weight: .bold, design: .rounded)).multilineTextAlignment(.center).foregroundStyle(.secondary)
        }
    }
}

// MARK: - Streak (small + Lock Screen)

struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FemataStreak", provider: FemataProvider()) { entry in
            StreakView(entry: entry).containerBackground(.fill.tertiary, for: .widget).widgetURL(URL(string: "femata://student"))
        }
        .configurationDisplayName("Streak")
        .description("Your streak, and what keeps it going today.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct StreakView: View {
    @Environment(\.widgetFamily) var family
    let entry: FemataEntry

    var body: some View {
        if let s = entry.snapshot, s.role == "student" {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(s.todayLit ? "FlameLit" : "FlameDim").resizable().scaledToFit().frame(width: 20, height: 20)
                        Text("\(s.streak)").font(.system(size: 15, weight: .black, design: .rounded))
                    }
                }
            case .accessoryRectangular:
                HStack(spacing: 6) {
                    Image(s.mood(at: entry.date)).resizable().scaledToFit().frame(width: 30)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(s.streak)-day streak").font(.system(size: 13, weight: .heavy, design: .rounded))
                        Text(s.todayLit ? "Today's lit" : "\(s.todayMinutes) of \(s.goalMinutes) min today").font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundStyle(.secondary)
                        ProgressView(value: Double(min(s.todayMinutes, max(1, s.goalMinutes))), total: Double(max(1, s.goalMinutes)))
                    }
                }
            case .accessoryInline:
                Text(s.todayLit ? "🔥 \(s.streak) · today's lit" : "🔥 \(s.streak) · \(s.line)")
            default:
                ZStack(alignment: .bottomTrailing) {
                    VStack(alignment: .leading, spacing: 2) {
                        FlameNumber(lit: s.todayLit, number: s.streak, size: 30)
                        Text("day streak").font(.system(size: 12, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                        Text(s.line)
                            .font(.system(size: 12.5, weight: .black, design: .rounded))
                            .foregroundStyle(s.todayLit ? flameOrange : .primary)
                            .frame(maxWidth: 82, alignment: .leading)
                            .padding(.top, 2)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    Image(s.mood(at: entry.date)).resizable().scaledToFit().frame(width: 74).offset(x: 8, y: 8)
                }
            }
        } else {
            OpenFemata(text: "Open Femata to see your streak")
        }
    }
}

// MARK: - Today (medium)

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FemataToday", provider: FemataProvider()) { entry in
            TodayView(entry: entry).containerBackground(.fill.tertiary, for: .widget).widgetURL(URL(string: "femata://student"))
        }
        .configurationDisplayName("Today")
        .description("Your week, today's goal and a button to start.")
        .supportedFamilies([.systemMedium])
    }
}

struct TodayView: View {
    let entry: FemataEntry
    var body: some View {
        if let s = entry.snapshot, s.role == "student" {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("TODAY").font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                    Text(s.todayLit ? (s.todayMinutes >= s.goalMinutes ? "Goal done. See you tomorrow!" : "Nice work today!") : "Ready to practise?")
                        .font(.system(size: 16, weight: .black, design: .rounded)).lineLimit(2)
                    WeekDots(week: s.week, todayIndex: s.todayIndex)
                    HStack(spacing: 8) {
                        if s.todayLit && s.streakGoal > s.streak {
                            Image("FemataCelebrate").resizable().scaledToFit().frame(width: 34)
                            Text("\(s.streakGoal)-day goal: \(s.streakGoal - s.streak) to go").font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                        } else {
                            Link(destination: URL(string: "femata://session")!) {
                                Label("Start", systemImage: "play.fill")
                                    .font(.system(size: 12, weight: .black, design: .rounded))
                                    .padding(.horizontal, 11).padding(.vertical, 6)
                                    .background(sky, in: Capsule())
                                    .foregroundStyle(.white)
                            }
                            Image(s.todayLit ? "FemataProud" : "FemataWink").resizable().scaledToFit().frame(width: 34)
                        }
                    }
                }
                Spacer(minLength: 0)
                GoalRing(minutes: s.todayMinutes, goal: s.goalMinutes)
            }
        } else {
            OpenFemata(text: "Open Femata to see your day")
        }
    }
}

// MARK: - Teacher

struct TeacherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FemataTeacher", provider: FemataProvider()) { entry in
            TeacherView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Studio")
        .description("Your next lesson and what's waiting to review.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct TeacherView: View {
    @Environment(\.widgetFamily) var family
    let entry: FemataEntry

    var lesson: some View {
        Link(destination: URL(string: "femata://calendar")!) {
            ZStack(alignment: .bottomTrailing) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("NEXT LESSON").font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                    if let s = entry.snapshot, let start = s.nextLessonStart, start > entry.date {
                        Text(start, style: .time).font(.system(size: 24, weight: .black, design: .rounded))
                        Text(s.nextLessonTitle ?? "").font(.system(size: 13, weight: .black, design: .rounded)).lineLimit(1)
                        Text(start, style: .relative).font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                    } else {
                        Text("Nothing booked").font(.system(size: 15, weight: .black, design: .rounded)).padding(.top, 4)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                Image("FemataFocused").resizable().scaledToFit().frame(width: 52).offset(x: 6, y: 6)
            }
        }
    }

    var review: some View {
        Link(destination: URL(string: "femata://review")!) {
            ZStack(alignment: .bottomTrailing) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TO REVIEW").font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                    Text("\(entry.snapshot?.toReview ?? 0)").font(.system(size: 34, weight: .black, design: .rounded)).foregroundStyle(skyDeep)
                    Text((entry.snapshot?.toReview ?? 0) == 1 ? "recording waiting" : "recordings waiting").font(.system(size: 12, weight: .black, design: .rounded))
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                Image((entry.snapshot?.toReview ?? 0) > 0 ? "FemataThinking" : "FemataCool").resizable().scaledToFit().frame(width: 52).offset(x: 6, y: 6)
            }
        }
    }

    var body: some View {
        if let s = entry.snapshot, s.role == "teacher" {
            if family == .systemMedium {
                HStack(spacing: 14) { lesson; Divider(); review }
            } else {
                lesson
            }
        } else {
            OpenFemata(text: "For teachers: open Femata")
        }
    }
}

// MARK: - Live Activity

struct PracticeLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PracticeActivityAttributes.self) { context in
            LiveLockScreen(state: context.state)
                .activityBackgroundTint(ink.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "femata://session"))
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(face(s)).resizable().scaledToFit().frame(width: 46).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Clock(state: s, size: 24).frame(width: 78, alignment: .trailing).padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(s.category.isEmpty ? "Practising" : s.category).font(.system(size: 12, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                        Text(s.piece.isEmpty ? "Practice" : s.piece).font(.system(size: 15, weight: .black, design: .rounded)).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        GoalBar(state: s)
                        Controls(state: s)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(face(s)).resizable().scaledToFit().frame(width: 24)
            } compactTrailing: {
                Clock(state: s, size: 13).frame(maxWidth: 52)
            } minimal: {
                Image(face(s)).resizable().scaledToFit().frame(width: 20)
            }
            .widgetURL(URL(string: "femata://session"))
            .keylineTint(sky)
        }
    }
}

private func face(_ s: PracticeActivityAttributes.ContentState) -> String {
    if s.doneMinutes != nil { return "FemataCelebrate" }
    return s.pausedElapsed != nil ? "FemataSleepy" : "FemataFocused"
}

private func clockText(_ seconds: Double) -> String {
    let t = Int(seconds)
    return t >= 3600 ? String(format: "%d:%02d:%02d", t / 3600, (t / 60) % 60, t % 60) : String(format: "%d:%02d", t / 60, t % 60)
}

/// Counts up on its own while running; stands still while paused.
struct Clock: View {
    let state: PracticeActivityAttributes.ContentState
    let size: CGFloat
    var body: some View {
        Group {
            if let done = state.doneMinutes {
                Text("+\(done) min").foregroundStyle(Color(red: 1, green: 0.79, blue: 0.24))
            } else if let paused = state.pausedElapsed {
                Text(clockText(paused)).foregroundStyle(Color(red: 1, green: 0.79, blue: 0.24))
            } else {
                // An hour's range and no hours shown, so the clock is sized
                // for "mm:ss" rather than "h:mm:ss" and never cut off.
                Text(timerInterval: state.startedAt...state.startedAt.addingTimeInterval(3599), countsDown: false, showsHours: false)
                    .foregroundStyle(sky)
            }
        }
        .font(.system(size: size, weight: .black, design: .rounded))
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
    }
}

/// Today's goal, filling as the session runs.
struct GoalBar: View {
    let state: PracticeActivityAttributes.ContentState
    var body: some View {
        let goal = Double(max(1, state.goalMinutes)) * 60
        let before = Double(state.todayMinutesBefore) * 60
        Group {
            if let paused = state.pausedElapsed ?? state.doneMinutes.map({ Double($0) * 60 }) {
                ProgressView(value: min(goal, before + paused), total: goal)
            } else if before >= goal {
                ProgressView(value: 1, total: 1)
            } else {
                ProgressView(timerInterval: state.startedAt.addingTimeInterval(-before)...state.startedAt.addingTimeInterval(goal - before), countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
            }
        }
        .tint(sky)
    }
}

struct Controls: View {
    let state: PracticeActivityAttributes.ContentState
    var body: some View {
        HStack(spacing: 8) {
            if state.doneMinutes == nil {
                if state.pausedElapsed != nil {
                    Button(intent: ResumePracticeIntent()) {
                        Label("Resume", systemImage: "play.fill").lineLimit(1).fixedSize()
                    }
                    .tint(sky)
                } else {
                    Button(intent: PausePracticeIntent()) {
                        Label("Pause", systemImage: "pause.fill").lineLimit(1).fixedSize()
                    }
                    .tint(.white.opacity(0.25))
                }
                Link(destination: URL(string: "femata://session?finish=1")!) {
                    Label("Finish", systemImage: "checkmark")
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(sky, in: Capsule())
                        .foregroundStyle(ink)
                }
                .buttonStyle(.plain)
            } else {
                Text("Saved. Nice work!").font(.system(size: 13, weight: .heavy, design: .rounded))
            }
            Spacer(minLength: 0)
            Text("\(state.goalMinutes > 0 ? "\(state.goalMinutes) min goal" : "")").font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
        }
        .font(.system(size: 13, weight: .black, design: .rounded))
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
    }
}

struct LiveLockScreen: View {
    let state: PracticeActivityAttributes.ContentState
    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(face(state)).resizable().scaledToFit().frame(width: 54)
                VStack(alignment: .leading, spacing: 1) {
                    Text(state.doneMinutes != nil ? "Session saved" : (state.pausedElapsed != nil ? "Paused" : "Practising\(state.category.isEmpty ? "" : " · \(state.category)")"))
                        .font(.system(size: 12, weight: .heavy, design: .rounded)).foregroundStyle(.white.opacity(0.65))
                    Text(state.piece.isEmpty ? "Practice" : state.piece).font(.system(size: 15, weight: .black, design: .rounded)).foregroundStyle(.white).lineLimit(1)
                }
                Spacer(minLength: 0)
                Clock(state: state, size: 28)
            }
            GoalBar(state: state)
            Controls(state: state)
        }
        .padding(14)
        .foregroundStyle(.white)
    }
}
