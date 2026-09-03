import Flutter
import UIKit
import GoogleMaps

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let assetKey = FlutterDartProject.lookupKey(forAsset: ".env")
    if let envPath = Bundle.main.path(forResource: assetKey, ofType: nil),
       let envString = try? String(contentsOfFile: envPath) {
        let lines = envString.components(separatedBy: .newlines)
        for line in lines {
            let parts = line.components(separatedBy: "=")
            if parts.count >= 2, parts[0].trimmingCharacters(in: .whitespaces) == "GOOGLE_MAPS_API_KEY" {
                let key = parts[1...].joined(separator: "=").trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\"", with: "")
                GMSServices.provideAPIKey(key)
                break
            }
        }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
