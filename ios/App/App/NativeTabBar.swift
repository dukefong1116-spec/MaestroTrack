import UIKit
import Capacitor

/// The app's main screen: Capacitor's web view, plus the native pieces the
/// web app asks for. Registered in SceneDelegate in place of the plain
/// CAPBridgeViewController.
class MutifViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTabBarPlugin())
    }
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

private extension UIColor {
    /// "#RRGGBB"
    convenience init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}
