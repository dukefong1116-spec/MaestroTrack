import Foundation
import UIKit
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// The web app's way into the widgets and the practice Live Activity.
///
///  - update: the numbers the widgets show (streak, today, goal, the
///    teacher's next lesson…), saved where the widget extension reads them.
///  - liveStart / liveUpdate / liveEnd: the session on the Lock Screen and
///    in the Dynamic Island, following the practice timer.
///  - takePending: Pause / Resume pressed on the Live Activity while the
///    app was not looking.
///  - an `open` event when a widget or the Live Activity opens a femata://
///    link, so the web app can go to that page.
@objc(FemataWidgetsPlugin)
public class FemataWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FemataWidgetsPlugin"
    public let jsName = "FemataWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveEnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePending", returnType: CAPPluginReturnPromise),
    ]

    private var lastURL: String?

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(openedURL(_:)), name: .capacitorOpenURL, object: nil)
        // `-liveDemo` at launch starts a sample practice Live Activity, and
        // `-widgetDemo` writes sample widget numbers — for checking the
        // native look in the simulator only.
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-widgetDemo") {
            let demo: [String: Any] = ["role": "student", "day": FemataSnapshot.dayString(), "name": "Kai", "streak": 12, "todayLit": false, "todayMinutes": 0, "goalMinutes": 30, "week": [true, true, true, true, true, true, false], "todayIndex": 6, "streakGoal": 14, "toReview": 0]
            if let data = try? JSONSerialization.data(withJSONObject: demo) {
                FemataShared.defaults?.set(data, forKey: FemataShared.snapshotKey)
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
        #if canImport(ActivityKit)
        if args.contains("-liveDemo"), #available(iOS 16.2, *) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                guard Activity<PracticeActivityAttributes>.activities.isEmpty else { return }
                let s = PracticeActivityAttributes.ContentState(startedAt: Date().addingTimeInterval(-754), pausedElapsed: nil, category: "Scales", piece: "Für Elise", todayMinutesBefore: 0, goalMinutes: 30, doneMinutes: nil)
                do { _ = try Activity.request(attributes: PracticeActivityAttributes(), content: ActivityContent(state: s, staleDate: nil), pushType: nil) }
                catch { print("[liveDemo] request failed:", error) }
            }
        }
        #endif
    }

    @objc private func openedURL(_ note: Notification) {
        guard let info = note.object as? [String: Any], let url = info["url"] as? URL, url.scheme == "femata" else { return }
        lastURL = url.absoluteString
        notifyListeners("open", data: ["url": url.absoluteString], retainUntilConsumed: true)
    }

    @objc func update(_ call: CAPPluginCall) {
        guard let snapshot = call.getObject("snapshot"),
              let data = try? JSONSerialization.data(withJSONObject: snapshot) else {
            call.reject("no snapshot")
            return
        }
        FemataShared.defaults?.set(data, forKey: FemataShared.snapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Signed out: nothing of that account stays on the Home Screen.
    @objc func clear(_ call: CAPPluginCall) {
        FemataShared.defaults?.removeObject(forKey: FemataShared.snapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func takePending(_ call: CAPPluginCall) {
        call.resolve(["actions": FemataShared.takePending()])
    }

    // MARK: Live Activity

    private func num(_ call: CAPPluginCall, _ key: String) -> Double? {
        (call.options[key] as? NSNumber)?.doubleValue
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func state(from call: CAPPluginCall) -> PracticeActivityAttributes.ContentState {
        let startedMs = num(call, "startedAt") ?? Date().timeIntervalSince1970 * 1000
        return PracticeActivityAttributes.ContentState(
            startedAt: Date(timeIntervalSince1970: startedMs / 1000),
            pausedElapsed: num(call, "pausedElapsed"),
            category: call.getString("category") ?? "",
            piece: call.getString("piece") ?? "",
            todayMinutesBefore: Int(num(call, "todayMinutesBefore") ?? 0),
            goalMinutes: Int(num(call, "goalMinutes") ?? 0),
            doneMinutes: nil
        )
    }
    #endif

    @objc func liveStart(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let s = state(from: call)
        Task {
            if let existing = Activity<PracticeActivityAttributes>.activities.first {
                await existing.update(ActivityContent(state: s, staleDate: nil))
            } else {
                _ = try? Activity.request(attributes: PracticeActivityAttributes(), content: ActivityContent(state: s, staleDate: nil), pushType: nil)
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    @objc func liveUpdate(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let s = state(from: call)
        Task {
            for activity in Activity<PracticeActivityAttributes>.activities {
                await activity.update(ActivityContent(state: s, staleDate: nil))
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    /// doneMinutes: the session was saved, so it celebrates for a few
    /// seconds before going; without it, it goes at once.
    @objc func liveEnd(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let done = num(call, "doneMinutes").map { Int($0) }
        Task {
            for activity in Activity<PracticeActivityAttributes>.activities {
                var s = activity.content.state
                if let d = done {
                    s.doneMinutes = d
                    s.pausedElapsed = s.pausedElapsed ?? Date().timeIntervalSince(s.startedAt)
                    await activity.end(ActivityContent(state: s, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(4)))
                } else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }
}
