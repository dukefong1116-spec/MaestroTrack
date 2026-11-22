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

import UserNotifications

/// Notifications: the reminders the app schedules on the phone, permission,
/// registering for pushes from the server, and what a tap on one opens.
///
///  - schedule({ items }): replaces every reminder this app has scheduled
///    with these (the web app works out the whole next week each time, so
///    practising cancels tonight's nudges just by not including them).
///    Each item: id, title, body, at (ms since 1970), mood (Femata's face),
///    url (femata://…), passive (deliver quietly, no sound).
///  - status() / request(): permission, without and with asking.
///  - register(): ask iOS for a push token; it arrives as a `token` event.
@objc(FemataNotifyPlugin)
public class FemataNotifyPlugin: CAPPlugin, CAPBridgedPlugin, UNUserNotificationCenterDelegate {
    public let identifier = "FemataNotifyPlugin"
    public let jsName = "FemataNotify"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
    ]
    static let prefix = "femata."
    static let tokenNote = Notification.Name("FemataPushToken")

    override public func load() {
        UNUserNotificationCenter.current().delegate = self
        NotificationCenter.default.addObserver(self, selector: #selector(gotToken(_:)), name: FemataNotifyPlugin.tokenNote, object: nil)
        // `-notifyDemo` at launch: one reminder ten seconds later, through the
        // real scheduling path — for checking the look in the simulator only.
        if ProcessInfo.processInfo.arguments.contains("-notifyDemo") {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in
                let at = (Date().timeIntervalSince1970 + 10) * 1000
                // Outside the plan's own ids, so the real plan does not replace it.
                self.add([
                    "id": "demo", "kind": "streak-daily", "title": "Hey Kai!", "body": "Your 12-day streak is waiting. 10 minutes is all it takes 🎵",
                    "at": at, "mood": "Proud", "url": "femata://go?to=%2Fstudent%2Fstreak",
                ], prefix: "demo.")
            }
        }
    }

    @objc private func gotToken(_ note: Notification) {
        guard let token = note.object as? String else { return }
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        notifyListeners("token", data: ["token": token, "env": env], retainUntilConsumed: true)
    }

    private func statusName(_ s: UNAuthorizationStatus) -> String {
        switch s {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "prompt"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            call.resolve(["status": self.statusName(s.authorizationStatus)])
        }
    }

    @objc func request(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            call.resolve(["status": granted ? "granted" : "denied"])
        }
    }

    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
            call.resolve()
        }
    }

    /// Femata's face as the notification's picture, written once to a file
    /// (iOS takes attachments from files only).
    private func attachment(_ mood: String?) -> UNNotificationAttachment? {
        let fallback: [String: String] = ["Sad": "Thinking", "Surprised": "Excited"]
        guard let mood = mood else { return nil }
        let name = "Femata" + (UIImage(named: "Femata" + mood) == nil ? (fallback[mood] ?? "Happy") : mood)
        guard let image = UIImage(named: name), let data = image.pngData() else { print("[notify] no image", name); return nil }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("femata-notify", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // A fresh copy each time: iOS moves the file it is given.
        let url = dir.appendingPathComponent("\(name)-\(UUID().uuidString).png")
        guard (try? data.write(to: url)) != nil else { return nil }
        do { return try UNNotificationAttachment(identifier: name, url: url, options: nil) }
        catch { print("[notify] attachment failed", error); return nil }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let items = call.getArray("items") as? [[String: Any]] ?? []
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            // Only ever our own: a fresh plan replaces the old one entirely.
            let ours = pending.map(\.identifier).filter { $0.hasPrefix(FemataNotifyPlugin.prefix) }
            center.removePendingNotificationRequests(withIdentifiers: ours)
            var added = 0
            for item in items where self.add(item, prefix: FemataNotifyPlugin.prefix) { added += 1 }
            call.resolve(["scheduled": added])
        }
    }

    /// One reminder, from the web app's plan. False when it is not in the future.
    @discardableResult
    private func add(_ item: [String: Any], prefix: String) -> Bool {
                guard let id = item["id"] as? String,
                      let at = (item["at"] as? NSNumber)?.doubleValue,
                      at > Date().timeIntervalSince1970 * 1000 else { return false }
                let content = UNMutableNotificationContent()
                content.title = item["title"] as? String ?? ""
                content.body = item["body"] as? String ?? ""
                content.threadIdentifier = item["kind"] as? String ?? "femata"
                if let url = item["url"] as? String { content.userInfo = ["url": url] }
                if (item["passive"] as? Bool) == true {
                    content.interruptionLevel = .passive
                } else {
                    content.sound = .default
                }
                if let a = self.attachment(item["mood"] as? String) { content.attachments = [a] }
                let when = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date(timeIntervalSince1970: at / 1000))
                let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
                UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger))
                return true
    }

    // Shown even while the app is open (a message arriving mid-practice).
    public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    // A tap opens what it is about, through the same path as the widgets' links.
    public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        if let s = response.notification.request.content.userInfo["url"] as? String, let url = URL(string: s) {
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .capacitorOpenURL, object: ["url": url, "options": [:]])
            }
        }
        completionHandler()
    }
}
