import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif
#if canImport(AppIntents)
import AppIntents
#endif

/// Shared between the app and the FemataWidgets extension (the file is in
/// both targets): where the app leaves numbers for the widgets, and what a
/// practice session's Live Activity carries.
enum FemataShared {
    static let group = "group.com.mutiftrack.app"
    static let snapshotKey = "femata.snapshot"
    static let pendingKey = "femata.pendingSessionActions"

    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }

    /// Something done on the Live Activity (Pause, Resume) for the app to
    /// catch up on when it next runs.
    static func addPending(_ action: String) {
        guard let d = defaults else { return }
        var list = d.stringArray(forKey: pendingKey) ?? []
        list.append(action)
        d.set(list, forKey: pendingKey)
    }

    static func takePending() -> [String] {
        guard let d = defaults else { return [] }
        let list = d.stringArray(forKey: pendingKey) ?? []
        d.removeObject(forKey: pendingKey)
        return list
    }
}

/// What the widgets show. Written by the app whenever it changes.
struct FemataSnapshot: Codable {
    var role: String            // "student" or "teacher"
    var day: String             // the local day these numbers were for, yyyy-MM-dd
    var name: String
    // student
    var streak: Int
    var todayLit: Bool
    var todayMinutes: Int
    var goalMinutes: Int
    var week: [Bool]            // Monday … Sunday, practised
    var todayIndex: Int         // 0 = Monday
    var streakGoal: Int
    // teacher
    var nextLessonTitle: String?
    var nextLessonStart: Date?
    var toReview: Int
    /// Coming lessons, soonest first: the teacher's studio, or a student's own.
    var agenda: [AgendaItem]?

    struct AgendaItem: Codable, Hashable {
        var title: String
        var start: Date
        var minutes: Int
    }

    static func load() -> FemataSnapshot? {
        guard let data = FemataShared.defaults?.data(forKey: FemataShared.snapshotKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return try? decoder.decode(FemataSnapshot.self, from: data)
    }

    static func dayString(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    /// The same numbers, carried past midnight: a new day has nothing
    /// practised yet, and the week strip moves on.
    func asOf(_ date: Date) -> FemataSnapshot {
        let today = FemataSnapshot.dayString(date)
        guard today != day else { return self }
        var s = self
        s.day = today
        s.todayLit = false
        s.todayMinutes = 0
        let weekday = (Calendar(identifier: .gregorian).component(.weekday, from: date) + 5) % 7 // Monday = 0
        if weekday < s.todayIndex { s.week = Array(repeating: false, count: 7) } // a new week
        if weekday < s.week.count { s.week[weekday] = false }
        s.todayIndex = weekday
        return s
    }
}

#if canImport(ActivityKit)
/// A practice session, live on the Lock Screen and in the Dynamic Island.
@available(iOS 16.1, *)
struct PracticeActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// When the clock would have started had it never been paused, so
        /// the system can count up on its own.
        var startedAt: Date
        /// Set while paused: the seconds on the clock.
        var pausedElapsed: Double?
        var category: String
        var piece: String
        var todayMinutesBefore: Int
        var goalMinutes: Int
        /// The session was saved: a moment of celebration, then it goes.
        var doneMinutes: Int?
    }
}
#endif

#if canImport(AppIntents) && canImport(ActivityKit)
/// Pause from the Dynamic Island or Lock Screen, without opening the app.
@available(iOS 17.0, *)
struct PausePracticeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause practice"
    init() {}
    func perform() async throws -> some IntentResult {
        for activity in Activity<PracticeActivityAttributes>.activities {
            var state = activity.content.state
            if state.pausedElapsed == nil { state.pausedElapsed = max(0, Date().timeIntervalSince(state.startedAt)) }
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }
        FemataShared.addPending("pause")
        return .result()
    }
}

/// Carry on from the Dynamic Island or Lock Screen.
@available(iOS 17.0, *)
struct ResumePracticeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Resume practice"
    init() {}
    func perform() async throws -> some IntentResult {
        for activity in Activity<PracticeActivityAttributes>.activities {
            var state = activity.content.state
            if let paused = state.pausedElapsed {
                state.startedAt = Date().addingTimeInterval(-paused)
                state.pausedElapsed = nil
            }
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }
        FemataShared.addPending("resume")
        return .result()
    }
}
#endif
