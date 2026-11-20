# The iPhone app

The same React app, shipped inside a native iOS shell with Capacitor. The
web version keeps deploying to Vercel exactly as before.

## Day to day

```bash
npm run ios        # build the web app, copy it into Xcode, open Xcode
npm run ios:sync   # the same without opening Xcode
```

In Xcode, pick an iPhone (a simulator, or your own phone plugged in) and press Run.

The app's files are inside the app, so a web change reaches the iPhone app
only after `npm run ios:sync` and a new build from Xcode.

## How it is put together

- `capacitor.config.ts` — app id `com.mutiftrack.app`, name "Mutif", built files from `dist/`.
- `ios/App/App.xcodeproj` — the Xcode project. Icon and launch screen are in
  `ios/App/App/Assets.xcassets`; permissions (microphone, camera, photos) in `Info.plist`.
- `src/lib/native.ts` — inside the app the page's address is `capacitor://localhost`,
  so API calls and links meant for other people go to the website instead.
- `api/_lib/admin.js` — the league API accepts calls from the app's address.
- The service worker is off inside the app: the files are already on the phone.

## On your own iPhone

1. Plug the phone in, open the project (`npm run ios`).
2. Xcode › the App target › Signing & Capabilities › choose your Apple ID as the Team.
3. Pick the phone as the run destination and press Run. The first time, allow the
   developer on the phone: Settings › General › VPN & Device Management.

A free Apple ID installs for 7 days at a time. TestFlight and the App Store need the
Apple Developer Program ($99 a year).
