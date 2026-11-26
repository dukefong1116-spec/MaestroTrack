import UIKit
import Capacitor
import CoreHaptics
import Photos
import MessageUI
import AuthenticationServices
import CryptoKit

/// The app's main screen: Capacitor's web view, plus the native pieces the
/// web app asks for. Registered in SceneDelegate in place of the plain
/// CAPBridgeViewController.
class MutifViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTabBarPlugin())
        bridge?.registerPluginInstance(NativeGlassPlugin())
        bridge?.registerPluginInstance(FemataHapticsPlugin())
        bridge?.registerPluginInstance(FemataNotifyPlugin())
        bridge?.registerPluginInstance(FemataWidgetsPlugin())
        bridge?.registerPluginInstance(FemataSharePlugin())
        bridge?.registerPluginInstance(FemataSignInPlugin())
        // Femata blue behind the page until it paints, so the launch screen
        // runs straight into the web one with no white flash. The page
        // paints its own background over it from then on.
        let blue = UIColor(red: 0.239, green: 0.710, blue: 0.961, alpha: 1)
        view.backgroundColor = blue
        webView?.isOpaque = false
        webView?.backgroundColor = blue
        // Femata, centred where the page's own launch screen draws it, behind
        // the page: there from the first frame instead of after the page has
        // loaded. The page covers it once it paints; launchDone removes it.
        if let web = webView {
            web.scrollView.backgroundColor = .clear
            let femata = UIImageView(image: UIImage(named: "LaunchFemata"))
            femata.tag = MutifViewController.launchTag
            femata.translatesAutoresizingMaskIntoConstraints = false
            web.insertSubview(femata, at: 0)
            NSLayoutConstraint.activate([
                femata.centerXAnchor.constraint(equalTo: web.centerXAnchor),
                femata.centerYAnchor.constraint(equalTo: web.centerYAnchor),
            ])
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { femata.removeFromSuperview() }
        }
    }

    static let launchTag = 4242
}

/// Apple's own tab bar (UITabBar), floating over the web view.
///
/// Apple's guidance for Liquid Glass ("Adopting Liquid Glass") is to use the
/// standard system components: a UIKit tab bar picks up the material and its
/// behaviour by itself — the glass that lenses what scrolls beneath, the
/// selection that morphs and magnifies as a finger drags across the items —
/// none of which a web page can reproduce. So inside the iPhone app the web
/// tab bar steps aside and this one is shown instead. The web app decides
/// what is in it (`configure`), which item is selected (`select`) and when
/// it shows (`setVisible`); a tap comes back as a `select` event.
@objc(NativeTabBarPlugin)
public class NativeTabBarPlugin: CAPPlugin, CAPBridgedPlugin, UITabBarDelegate {
    public let identifier = "NativeTabBarPlugin"
    public let jsName = "NativeTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
    ]

    private var tabBar: UITabBar?
    private var ids: [String] = []

    override public func load() {
        // `-tabbarDemo` at launch shows a sample bar before signing in — for
        // checking the native look in the simulator only.
        if ProcessInfo.processInfo.arguments.contains("-tabbarDemo") {
            DispatchQueue.main.async {
                self.apply(items: [
                    ["id": "today", "title": "Today", "symbol": "sun.max"],
                    ["id": "calendar", "title": "Calendar", "symbol": "calendar"],
                    ["id": "students", "title": "Students", "symbol": "person.2"],
                    ["id": "review", "title": "Review", "symbol": "checklist", "badge": "2"],
                    ["id": "more", "title": "More", "symbol": "ellipsis"],
                ], selected: "today")
                self.tabBar?.isHidden = false
            }
        }
    }

    private func ensureBar() -> UITabBar? {
        if let bar = tabBar { return bar }
        guard let host = bridge?.viewController?.view else { return nil }
        let bar = UITabBar()
        // Hidden until the web app says its page is on screen (setVisible).
        bar.isHidden = true
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.delegate = self
        host.addSubview(bar)
        NSLayoutConstraint.activate([
            bar.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            bar.bottomAnchor.constraint(equalTo: host.bottomAnchor),
        ])
        tabBar = bar
        return bar
    }

    private func apply(items: [[String: Any]], selected: String?, tint: String? = nil) {
        guard let bar = ensureBar() else { return }
        // The app's own blue for the selected item, used sparingly as Apple
        // asks; everything else stays the system's.
        if let tint = tint, let color = UIColor(hex: tint) { bar.tintColor = color }
        ids = items.compactMap { $0["id"] as? String }
        let built: [UITabBarItem] = items.enumerated().map { index, item in
            let title = item["title"] as? String ?? ""
            let symbol = item["symbol"] as? String ?? "circle"
            // Light strokes at rest, regular when selected: the default weight
            // read heavy beside the app's own thin icons.
            let rest = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(weight: .light))
            let lit = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(weight: .regular))
            let tabItem = UITabBarItem(title: title, image: rest, selectedImage: lit)
            tabItem.tag = index
            if let badge = item["badge"] as? String, !badge.isEmpty { tabItem.badgeValue = badge }
            tabItem.accessibilityLabel = title
            return tabItem
        }
        bar.setItems(built, animated: false)
        if let selected = selected, let i = ids.firstIndex(of: selected) {
            bar.selectedItem = built[i]
        }
        // Showing it is setVisible's call alone: refreshing the tabs (a new
        // badge count) used to bring the bar back on pages that hide it.
    }

    @objc func configure(_ call: CAPPluginCall) {
        let items = call.getArray("items", [String: Any].self) ?? []
        let selected = call.getString("selected")
        let tint = call.getString("tint")
        DispatchQueue.main.async {
            self.apply(items: items, selected: selected, tint: tint)
            call.resolve()
        }
    }

    @objc func select(_ call: CAPPluginCall) {
        let id = call.getString("id")
        DispatchQueue.main.async {
            if let bar = self.tabBar {
                if let id = id, let i = self.ids.firstIndex(of: id), let items = bar.items, i < items.count {
                    bar.selectedItem = items[i]
                } else {
                    // A page that is not one of the tabs: nothing lit.
                    bar.selectedItem = nil
                }
            }
            call.resolve()
        }
    }

    @objc func setVisible(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? true
        DispatchQueue.main.async {
            self.tabBar?.isHidden = !visible
            call.resolve()
        }
    }

    public func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard item.tag >= 0, item.tag < ids.count else { return }
        notifyListeners("select", data: ["id": ids[item.tag]])
    }
}

/// Apple's own Liquid Glass controls, placed over the page where the web app
/// asks: a glass button (`button`) or a glass bar holding a segmented control
/// (`segmented`). Like the tab bar, they get the real material — the lensing,
/// the press that swells and magnifies, the selection that slides under a
/// dragging finger — which a web page cannot draw. The web app keeps its own
/// control in place (invisible) and tells us where it is; taps come back as
/// a `tap` event, segment changes as `change`.
@objc(NativeGlassPlugin)
public class NativeGlassPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeGlassPlugin"
    public let jsName = "NativeGlass"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "button", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "segmented", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "launchDone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appearance", returnType: CAPPluginReturnPromise),
    ]

    /// The app's own Light/Dark choice, so Apple's controls (tab bar, glass,
    /// keyboard) match the page rather than the phone's setting.
    @objc func appearance(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "system"
        DispatchQueue.main.async {
            let s: UIUserInterfaceStyle = style == "dark" ? .dark : style == "light" ? .light : .unspecified
            self.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = s
            self.bridge?.viewController?.overrideUserInterfaceStyle = s
            call.resolve()
        }
    }

    /// The page's launch screen has finished: the native Femata behind it can go.
    @objc func launchDone(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.bridge?.webView?.viewWithTag(MutifViewController.launchTag)?.removeFromSuperview()
            // From here what shows behind the page (under the keyboard, past
            // the edges) is the page's own ground, not the launch blue.
            self.bridge?.webView?.backgroundColor = .systemBackground
            self.bridge?.viewController?.view.backgroundColor = .systemBackground
            call.resolve()
        }
    }

    private var views: [String: UIView] = [:]

    override public func load() {
        // `-glassDemo` at launch shows a sample of each — for checking the
        // native look in the simulator only.
        guard ProcessInfo.processInfo.arguments.contains("-glassDemo") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            let seg = CAPPluginCall(callbackId: "demo", methodName: "segmented", options: ["id": "demo-seg", "items": ["To review 3", "Sent back 1", "Approved 8", "All 12"], "selected": 0, "tint": "#1F8FD1", "x": 12, "y": 640, "width": 378, "height": 52], success: { _, _ in }, error: { _ in })
            let btn = CAPPluginCall(callbackId: "demo", methodName: "button", options: ["id": "demo-btn", "symbol": "plus", "prominent": true, "tint": "#1F8FD1", "x": 318, "y": 560, "width": 56, "height": 56], success: { _, _ in }, error: { _ in })
            if let seg = seg { self.segmented(seg) }
            if let btn = btn { self.button(btn) }
        }
    }

    /// Per control, the box it is cut off at: the page's scroll area, so a
    /// control that scrolls with the page slides under its edges.
    private var clips: [String: UIView] = [:]

    /// The web view's CSS pixels are its points, measured from its own corner.
    private func place(_ v: UIView, _ call: CAPPluginCall) {
        guard let host = bridge?.viewController?.view, let web = bridge?.webView else { return }
        func num(_ k: String, _ d: Double) -> Double { (call.options[k] as? NSNumber)?.doubleValue ?? d }
        let r = web.convert(CGRect(x: num("x", 0), y: num("y", 0), width: num("width", 44), height: num("height", 44)), to: host)
        let id = call.getString("id") ?? ""
        if let c = call.getObject("clip") {
            func cn(_ k: String) -> Double { (c[k] as? NSNumber)?.doubleValue ?? 0 }
            let box = clips[id] ?? {
                let made = PassThroughView()
                made.clipsToBounds = true
                made.backgroundColor = .clear
                clips[id] = made
                return made
            }()
            box.frame = web.convert(CGRect(x: cn("x"), y: cn("y"), width: cn("width"), height: cn("height")), to: host)
            if box.superview == nil { host.addSubview(box) }
            if v.superview !== box { v.removeFromSuperview(); box.addSubview(v) }
            v.frame = r.offsetBy(dx: -box.frame.minX, dy: -box.frame.minY)
        } else {
            if v.superview !== host { v.removeFromSuperview(); host.addSubview(v) }
            v.frame = r
        }
        v.isHidden = false
    }

    @objc func button(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? "button"
        let symbol = call.getString("symbol")
        let title = call.getString("title")
        let prominent = call.getBool("prominent") ?? false
        let tint = call.getString("tint").flatMap { UIColor(hex: $0) }
        let label = call.getString("label")
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.resolve(); return }
            let b = (self.views[id] as? UIButton) ?? {
                let made = UIButton(type: .system)
                made.addAction(UIAction { [weak self] _ in self?.notifyListeners("tap", data: ["id": id]) }, for: .primaryActionTriggered)
                self.views[id] = made
                return made
            }()
            var cfg: UIButton.Configuration
            if #available(iOS 26.0, *) { cfg = prominent ? .prominentGlass() : .glass() }
            else { cfg = prominent ? .filled() : .tinted() }
            cfg.cornerStyle = .capsule
            // With words, the page's own button size (14pt), so it fits the
            // space the web button leaves; an icon alone is drawn larger.
            if let s = symbol {
                cfg.image = UIImage(systemName: s, withConfiguration: UIImage.SymbolConfiguration(pointSize: title == nil ? 20 : 13, weight: .semibold))
            }
            if let t = title {
                var a = AttributedString(t)
                a.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
                cfg.attributedTitle = a
                cfg.titleLineBreakMode = .byClipping
            }
            cfg.imagePadding = 6
            cfg.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12)
            b.configuration = cfg
            if let t = tint { b.tintColor = t }
            b.accessibilityLabel = label ?? title
            self.place(b, call)
            call.resolve()
        }
    }

    @objc func segmented(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? "segmented"
        let items = call.getArray("items", String.self) ?? []
        let selected = call.getInt("selected") ?? 0
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.resolve(); return }
            // Apple's segmented control on its own: no glass bar around it,
            // just its grey track and white thumb.
            let bar: UIVisualEffectView
            let seg: UISegmentedControl
            if let existing = self.views[id] as? UIVisualEffectView, let s = existing.contentView.subviews.first as? UISegmentedControl {
                bar = existing; seg = s
            } else {
                bar = UIVisualEffectView(effect: nil)
                bar.layer.cornerRadius = 26
                bar.layer.cornerCurve = .continuous
                bar.clipsToBounds = true
                seg = UISegmentedControl()
                seg.translatesAutoresizingMaskIntoConstraints = false
                bar.contentView.addSubview(seg)
                NSLayoutConstraint.activate([
                    seg.leadingAnchor.constraint(equalTo: bar.contentView.leadingAnchor),
                    seg.trailingAnchor.constraint(equalTo: bar.contentView.trailingAnchor),
                    seg.centerYAnchor.constraint(equalTo: bar.contentView.centerYAnchor),
                    seg.heightAnchor.constraint(equalToConstant: 40),
                ])
                seg.addAction(UIAction { [weak self, weak seg] _ in
                    guard let seg = seg else { return }
                    self?.notifyListeners("change", data: ["id": id, "index": seg.selectedSegmentIndex])
                }, for: .valueChanged)
                self.views[id] = bar
            }
            let current = (0..<seg.numberOfSegments).map { seg.titleForSegment(at: $0) ?? "" }
            if current != items {
                seg.removeAllSegments()
                for (i, t) in items.enumerated() { seg.insertSegment(withTitle: t, at: i, animated: false) }
            }
            if seg.selectedSegmentIndex != selected { seg.selectedSegmentIndex = selected }
            let font = UIFont.systemFont(ofSize: 13, weight: .semibold)
            // The chosen piece in full ink, the others quieter, so the choice
            // reads at a glance (as on the website).
            seg.setTitleTextAttributes([.font: font, .foregroundColor: UIColor.secondaryLabel], for: .normal)
            seg.setTitleTextAttributes([.font: font, .foregroundColor: UIColor.label], for: .selected)
            self.place(bar, call)
            let f = bar.frame
            bar.frame = CGRect(x: f.minX, y: f.midY - 26, width: f.width, height: 52)
            call.resolve()
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        DispatchQueue.main.async {
            self.views[id]?.removeFromSuperview()
            self.views[id] = nil
            self.clips[id]?.removeFromSuperview()
            self.clips[id] = nil
            call.resolve()
        }
    }
}

/// A box that only clips what is inside it: touches anywhere but on its
/// control go straight through to the page (and the tab bar) beneath.
private final class PassThroughView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}

private extension UIColor {
    /// "#RRGGBB"
    convenience init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}


/// The app's haptics: each moment its own pattern of taps and rumbles,
/// played with Core Haptics so strength, sharpness and length can all be
/// shaped (a soft purr for a pat, a thud for a drop, a rising rumble into
/// a pop for a commitment). The web app sends the pattern; nothing here
/// knows what the moments are.
///
/// `play({ events: [{ t, i, s, d? }] })`: t = start in seconds, i =
/// intensity 0–1, s = sharpness 0–1, d = length in seconds for a rumble
/// (none: a single tap).
@objc(FemataHapticsPlugin)
public class FemataHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FemataHapticsPlugin"
    public let jsName = "FemataHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
    ]

    private var engine: CHHapticEngine?
    private lazy var fallback = UIImpactFeedbackGenerator(style: .medium)

    private func readyEngine() -> CHHapticEngine? {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return nil }
        if let e = engine { return e }
        do {
            let e = try CHHapticEngine()
            e.isAutoShutdownEnabled = true
            // The system stops the engine when the app goes to the
            // background; it starts again on the next pattern.
            e.resetHandler = { [weak e] in try? e?.start() }
            try e.start()
            engine = e
            return e
        } catch {
            return nil
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        let raw = call.getArray("events") as? [[String: Any]] ?? []
        DispatchQueue.main.async {
            let events: [CHHapticEvent] = raw.compactMap { ev in
                let t = (ev["t"] as? NSNumber)?.doubleValue ?? 0
                let i = Float((ev["i"] as? NSNumber)?.doubleValue ?? 0.5)
                let s = Float((ev["s"] as? NSNumber)?.doubleValue ?? 0.5)
                let params = [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: max(0, min(1, i))),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: max(0, min(1, s))),
                ]
                if let d = (ev["d"] as? NSNumber)?.doubleValue, d > 0 {
                    return CHHapticEvent(eventType: .hapticContinuous, parameters: params, relativeTime: t, duration: d)
                }
                return CHHapticEvent(eventType: .hapticTransient, parameters: params, relativeTime: t)
            }
            guard !events.isEmpty else { return }
            guard let engine = self.readyEngine() else {
                // No Core Haptics: one plain tap, so a moment still lands.
                self.fallback.impactOccurred(intensity: CGFloat((raw.first?["i"] as? NSNumber)?.doubleValue ?? 0.6))
                return
            }
            do {
                try engine.start()
                let player = try engine.makePlayer(with: CHHapticPattern(events: events, parameters: []))
                try player.start(atTime: CHHapticTimeImmediate)
            } catch {
                self.fallback.impactOccurred()
            }
        }
        call.resolve()
    }
}


/// Share cards, out of the app: saved straight to Photos, or attached to a
/// new message, without the system share sheet in between. The card is
/// drawn by the web app and arrives as base64 PNG.
@objc(FemataSharePlugin)
public class FemataSharePlugin: CAPPlugin, CAPBridgedPlugin, MFMessageComposeViewControllerDelegate {
    public let identifier = "FemataSharePlugin"
    public let jsName = "FemataShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canMessage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "message", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareLink", returnType: CAPPluginReturnPromise),
    ]

    private var pending: CAPPluginCall?

    private func image(_ call: CAPPluginCall) -> (Data, UIImage)? {
        guard let b64 = call.getString("data"),
              let data = Data(base64Encoded: b64),
              let img = UIImage(data: data) else { return nil }
        return (data, img)
    }

    /// Into the photo library (add-only permission, asked the first time).
    @objc func saveImage(_ call: CAPPluginCall) {
        guard let (_, img) = image(call) else { call.reject("No image"); return }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                call.resolve(["saved": false, "denied": true]); return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: img)
            }) { ok, _ in call.resolve(["saved": ok]) }
        }
    }

    @objc func canMessage(_ call: CAPPluginCall) {
        call.resolve(["ok": MFMessageComposeViewController.canSendText() && MFMessageComposeViewController.canSendAttachments()])
    }

    /// A new message with the card attached and the words written; the
    /// person picks who it goes to and taps send themselves.
    @objc func message(_ call: CAPPluginCall) {
        let attachment = image(call)?.0
        DispatchQueue.main.async {
            guard MFMessageComposeViewController.canSendText() else { call.resolve(["sent": false]); return }
            let vc = MFMessageComposeViewController()
            vc.messageComposeDelegate = self
            vc.body = call.getString("text") ?? ""
            if let data = attachment { vc.addAttachmentData(data, typeIdentifier: "public.png", filename: "femata.png") }
            self.pending = call
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }

    /// The system share sheet with a link (which every app unfurls into
    /// the card), opened natively so it works even after the link was
    /// made — a web share has to come straight from the tap.
    @objc func shareLink(_ call: CAPPluginCall) {
        guard let s = call.getString("url"), let url = URL(string: s) else { call.reject("No link"); return }
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async {
            let vc = UIActivityViewController(activityItems: [text, url], applicationActivities: nil)
            vc.completionWithItemsHandler = { _, done, _, _ in call.resolve(["shared": done]) }
            if let pop = vc.popoverPresentationController, let v = self.bridge?.viewController?.view {
                pop.sourceView = v
                pop.sourceRect = CGRect(x: v.bounds.midX, y: v.bounds.maxY - 80, width: 1, height: 1)
            }
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }

    public func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: true)
        pending?.resolve(["sent": result == .sent])
        pending = nil
    }
}

/// Google and Apple sign-in in the app, where Firebase's web pop-ups cannot
/// open. Each hands back an ID token; the web side signs in to Firebase with
/// it (src/lib/firebase/auth.ts). Apple needs the Sign in with Apple
/// capability (paid Apple Developer Program); Google, the iOS client ID.
public class FemataSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "FemataSignInPlugin"
    public let jsName = "FemataSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "apple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "google", returnType: CAPPluginReturnPromise),
    ]
    private var pending: CAPPluginCall?
    private var session: ASWebAuthenticationSession?

    private var window: UIWindow {
        bridge?.viewController?.view.window ?? UIWindow()
    }
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { window }
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window }

    // MARK: Apple

    @objc func apple(_ call: CAPPluginCall) {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = call.getString("nonce")
        pending = call
        DispatchQueue.main.async {
            let c = ASAuthorizationController(authorizationRequests: [request])
            c.delegate = self
            c.presentationContextProvider = self
            c.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = cred.identityToken, let token = String(data: data, encoding: .utf8) else {
            pending?.reject("No token"); pending = nil; return
        }
        pending?.resolve(["idToken": token])
        pending = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        pending?.reject(cancelled ? "cancelled" : error.localizedDescription)
        pending = nil
    }

    // MARK: Google (OAuth with PKCE in the system's sign-in sheet)

    @objc func google(_ call: CAPPluginCall) {
        guard let clientId = call.getString("clientId"), clientId.hasSuffix(".apps.googleusercontent.com") else {
            call.reject("Google sign-in is not set up"); return
        }
        let scheme = clientId.split(separator: ".").reversed().joined(separator: ".")
        let redirect = "\(scheme):/oauth2redirect"
        let verifier = Self.random()
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        let state = Self.random()
        var url = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        url.queryItems = [
            .init(name: "client_id", value: clientId), .init(name: "redirect_uri", value: redirect),
            .init(name: "response_type", value: "code"), .init(name: "scope", value: "openid email profile"),
            .init(name: "code_challenge", value: challenge), .init(name: "code_challenge_method", value: "S256"),
            .init(name: "state", value: state), .init(name: "prompt", value: "select_account"),
        ]
        DispatchQueue.main.async {
            let s = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: scheme) { back, error in
                self.session = nil
                if let error = error {
                    let cancelled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                    call.reject(cancelled ? "cancelled" : error.localizedDescription); return
                }
                let items = URLComponents(url: back!, resolvingAgainstBaseURL: false)?.queryItems ?? []
                guard items.first(where: { $0.name == "state" })?.value == state,
                      let code = items.first(where: { $0.name == "code" })?.value else {
                    call.reject("Sign-in did not finish"); return
                }
                Self.exchange(code: code, clientId: clientId, redirect: redirect, verifier: verifier, call: call)
            }
            s.presentationContextProvider = self
            self.session = s
            s.start()
        }
    }

    private static func exchange(code: String, clientId: String, redirect: String, verifier: String, call: CAPPluginCall) {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var body = URLComponents()
        body.queryItems = [
            .init(name: "code", value: code), .init(name: "client_id", value: clientId),
            .init(name: "redirect_uri", value: redirect), .init(name: "code_verifier", value: verifier),
            .init(name: "grant_type", value: "authorization_code"),
        ]
        req.httpBody = body.percentEncodedQuery?.data(using: .utf8)
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = json["id_token"] as? String else {
                call.reject("Google did not return a sign-in"); return
            }
            call.resolve(["idToken": token])
        }.resume()
    }

    private static func random() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URL
    }
}

private extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
